import { ModuleClient, SessionClient } from "tlsclientwrapper";

let moduleClient: ModuleClient | null = null;

export function createTlsSession(): SessionClient {
  if (!moduleClient) {
    moduleClient = new ModuleClient();
  }

  return new SessionClient(moduleClient, {
    tlsClientIdentifier: "chrome_146",
    timeoutSeconds: 30,
  });
}

export async function destroyTlsModule(): Promise<void> {
  if (moduleClient) {
    await moduleClient.terminate();
    moduleClient = null;
  }
}
