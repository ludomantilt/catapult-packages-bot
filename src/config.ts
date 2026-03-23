import 'dotenv/config';

export interface Config {
  evmPrivateKey: string;
  apiUrl: string;
  tokenRank: 'Public' | 'Private';
  tokenMode: 'Slow' | 'Fast' | 'Flash' | 'Crack' | 'Mayhem';
  tokenPriceMode: 'One' | 'Ten' | 'Hundred' | 'FiveHundred';
  spreadStartHour: number;
  spreadEndHour: number;
  timezone: string;
  logLevel: string;
}

const TOKEN_RANKS = ['Public', 'Private'] as const;
const TOKEN_MODES = ['Slow', 'Fast', 'Flash', 'Crack', 'Mayhem'] as const;
const TOKEN_PRICE_MODES = ['One', 'Ten', 'Hundred', 'FiveHundred'] as const;

/** Token creation cost in USDT drops by rank and mode */
export const TOKEN_COST_USDT_DROPS: Record<string, Record<string, bigint>> = {
  Public: {
    Slow: 12_000_000n,
    Fast: 10_000_000n,
    Flash: 8_000_000n,
    Crack: 5_000_000n,
    Mayhem: 1_000_000n,
  },
  Private: {
    Slow: 1_000_000n,
    Fast: 1_000_000n,
    Flash: 1_000_000n,
    Crack: 1_000_000n,
    Mayhem: 1_000_000n,
  },
};

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function envOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): Config {
  const evmPrivateKey = requireEnv('EVM_PRIVATE_KEY');
  const apiUrl = envOrDefault('API_URL', 'https://api.catapult.trade/graphql');

  const tokenRank = envOrDefault('TOKEN_RANK', 'Public');
  if (!TOKEN_RANKS.includes(tokenRank as (typeof TOKEN_RANKS)[number])) {
    throw new Error(`Invalid TOKEN_RANK: ${tokenRank}. Must be one of: ${TOKEN_RANKS.join(', ')}`);
  }

  const tokenMode = envOrDefault('TOKEN_MODE', 'Mayhem');
  if (!TOKEN_MODES.includes(tokenMode as (typeof TOKEN_MODES)[number])) {
    throw new Error(`Invalid TOKEN_MODE: ${tokenMode}. Must be one of: ${TOKEN_MODES.join(', ')}`);
  }

  const tokenPriceMode = envOrDefault('TOKEN_PRICE_MODE', 'FiveHundred');
  if (!TOKEN_PRICE_MODES.includes(tokenPriceMode as (typeof TOKEN_PRICE_MODES)[number])) {
    throw new Error(`Invalid TOKEN_PRICE_MODE: ${tokenPriceMode}. Must be one of: ${TOKEN_PRICE_MODES.join(', ')}`);
  }

  const spreadStartHour = parseInt(envOrDefault('SPREAD_START_HOUR', '0'), 10);
  const spreadEndHour = parseInt(envOrDefault('SPREAD_END_HOUR', '23'), 10);

  if (spreadStartHour < 0 || spreadStartHour > 23) {
    throw new Error(`SPREAD_START_HOUR must be 0-23, got: ${spreadStartHour}`);
  }
  if (spreadEndHour < 0 || spreadEndHour > 23) {
    throw new Error(`SPREAD_END_HOUR must be 0-23, got: ${spreadEndHour}`);
  }
  if (spreadStartHour >= spreadEndHour) {
    throw new Error(`SPREAD_START_HOUR (${spreadStartHour}) must be less than SPREAD_END_HOUR (${spreadEndHour})`);
  }

  return {
    evmPrivateKey,
    apiUrl,
    tokenRank: tokenRank as Config['tokenRank'],
    tokenMode: tokenMode as Config['tokenMode'],
    tokenPriceMode: tokenPriceMode as Config['tokenPriceMode'],
    spreadStartHour,
    spreadEndHour,
    timezone: envOrDefault('TIMEZONE', 'UTC'),
    logLevel: envOrDefault('LOG_LEVEL', 'info'),
  };
}

export function getTokenCostUsdtDrops(config: Config): bigint {
  return TOKEN_COST_USDT_DROPS[config.tokenRank]![config.tokenMode]!;
}
