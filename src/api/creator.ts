import type pino from 'pino';
import type { GraphQLClient } from './client.js';
import { CREATOR_DAILY_LIMITS } from './queries.js';

export interface DailyLimits {
  activePackagesCount: number;
  carryoverUsdtDrops: string;
  dailyLimitUsdtDrops: string;
  remainingDailyLimitUsdtDrops: string;
  usedTodayUsdtDrops: string;
}

interface DailyLimitsResponse {
  turboCreatorDailyLimits: DailyLimits;
}

export class CreatorService {
  constructor(
    private readonly client: GraphQLClient,
    private readonly logger: pino.Logger,
  ) {}

  async getDailyLimits(): Promise<DailyLimits | null> {
    const response = await this.client.request<DailyLimitsResponse>(CREATOR_DAILY_LIMITS, undefined, "TurboCreatorDailyLimits");
    const limits = response.turboCreatorDailyLimits;

    if (!limits) {
      return null;
    }

    this.logger.info(
      {
        activePackages: limits.activePackagesCount,
        dailyLimit: formatUsdt(limits.dailyLimitUsdtDrops),
        remaining: formatUsdt(limits.remainingDailyLimitUsdtDrops),
        usedToday: formatUsdt(limits.usedTodayUsdtDrops),
      },
      'Daily limits fetched',
    );

    return limits;
  }
}

function formatUsdt(drops: string): string {
  const usdtAmount = Number(BigInt(drops)) / 1_000_000;
  return `${usdtAmount.toFixed(2)} USDT`;
}
