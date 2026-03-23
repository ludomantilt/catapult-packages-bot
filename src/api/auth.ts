import { ethers } from "ethers";
import type pino from "pino";
import { AUTH_LOGIN_EVM } from "./queries.js";
import type { GraphQLClient } from "./client.js";

const AUTH_CHALLENGE = "44467cfd-a7d7-4efe-a1ad-de6adb68036f";

interface AuthLoginEvmResponse {
  authLoginEvm: {
    accessToken: string;
  };
}

export class AuthService {
  private readonly wallet: ethers.Wallet;

  constructor(
    evmPrivateKey: string,
    private readonly client: GraphQLClient,
    private readonly logger: pino.Logger,
  ) {
    this.wallet = new ethers.Wallet(evmPrivateKey);
    this.logger.info(
      { walletAddress: this.wallet.address },
      "Wallet initialized",
    );
  }

  async login(): Promise<string> {
    this.logger.info("Signing auth challenge...");
    const signature = await this.wallet.signMessage(AUTH_CHALLENGE);

    this.logger.debug("Calling authLoginEvm...");
    const response = await this.client.request<AuthLoginEvmResponse>(
      AUTH_LOGIN_EVM,
      { input: { signature } },
      "AuthLoginEvm",
    );

    const accessToken = response.authLoginEvm.accessToken;
    this.client.setAccessToken(accessToken);
    this.logger.info("Authenticated successfully");

    return accessToken;
  }
}
