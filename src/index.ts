import { Wallet } from "ethers";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createTlsSession, destroyTlsModule } from "./api/tls.js";
import { GraphQLClient } from "./api/client.js";
import { AuthService } from "./api/auth.js";
import { CreatorService } from "./api/creator.js";
import { TokenService } from "./api/token.js";
import { Scheduler } from "./scheduler.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info("Catapult Creator Bot starting...");

  const session = createTlsSession();
  logger.info("TLS session created (chrome_146 profile)");

  logger.info(
    {
      apiUrl: config.apiUrl,
      tokenRank: config.tokenRank,
      tokenMode: config.tokenMode,
      tokenPriceMode: config.tokenPriceMode,
      spreadHours: `${config.spreadStartHour}:00 - ${config.spreadEndHour}:00`,
      timezone: config.timezone,
    },
    "Configuration loaded",
  );

  const client = new GraphQLClient(config.apiUrl, logger, session);
  const authService = new AuthService(config.evmPrivateKey, client, logger);
  const creatorService = new CreatorService(client, logger);
  const tokenService = new TokenService(client, config, logger);
  const scheduler = new Scheduler(
    config,
    authService,
    creatorService,
    tokenService,
    logger,
  );

  client.setOnUnauthorized(async () => {
    await authService.login();
  });

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down...");
    scheduler.stop();
    await session.destroySession();
    await destroyTlsModule();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await scheduler.start();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
