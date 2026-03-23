import type pino from "pino";
import type { SessionClient } from "tlsclientwrapper";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

export class GraphQLClient {
  private accessToken: string | null = null;
  private onUnauthorized: (() => Promise<void>) | null = null;

  constructor(
    private readonly apiUrl: string,
    private readonly logger: pino.Logger,
    private readonly session: SessionClient,
  ) {}

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setOnUnauthorized(handler: () => Promise<void>): void {
    this.onUnauthorized = handler;
  }

  async request<T>(
    query: string,
    variables?: Record<string, unknown>,
    operationName?: string,
  ): Promise<T> {
    const response = await this.rawRequest<T>(query, variables, operationName);

    if (response.errors?.length) {
      const firstError = response.errors[0]!;
      const isUnauthorized =
        firstError.extensions?.code === "UNAUTHENTICATED" ||
        firstError.message.toLowerCase().includes("unauthorized");

      if (isUnauthorized && this.onUnauthorized) {
        this.logger.info("Token expired, re-authenticating...");
        await this.onUnauthorized();
        const retryResponse = await this.rawRequest<T>(
          query,
          variables,
          operationName,
        );
        if (retryResponse.errors?.length) {
          throw new Error(
            `GraphQL error after re-auth: ${retryResponse.errors[0]!.message}`,
          );
        }
        return retryResponse.data!;
      }

      throw new Error(`GraphQL error: ${firstError.message}`);
    }

    if (!response.data) {
      throw new Error("GraphQL response missing data");
    }

    return response.data;
  }

  private async rawRequest<T>(
    query: string,
    variables?: Record<string, unknown>,
    operationName?: string,
  ): Promise<GraphQLResponse<T>> {
    const headers: Record<string, string> = {
      accept:
        "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed",
      "accept-language": "en-GB,en;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/json",
      pragma: "no-cache",
      priority: "u=1, i",
      "sec-ch-ua":
        '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    };

    if (this.accessToken) {
      headers["authorization"] = `Bearer ${this.accessToken}`;
    }

    const body = JSON.stringify({ operationName, query, variables });

    this.logger.debug({ url: this.apiUrl, body }, "Outgoing request");

    const response = await this.session.post(this.apiUrl, body, { headers });

    if (response.status >= 400) {
      this.logger.error(
        { status: response.status, body: response.body },
        "HTTP error response",
      );

      // Try to parse as GraphQL response (servers often return errors with 500)
      try {
        const parsed = JSON.parse(response.body) as GraphQLResponse<T>;
        if (parsed.errors?.length) {
          return parsed;
        }
      } catch {
        // Not JSON, throw raw error
      }

      throw new Error(
        `HTTP error: ${response.status} - ${response.body}`,
      );
    }

    return JSON.parse(response.body) as GraphQLResponse<T>;
  }
}
