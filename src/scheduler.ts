import cron from 'node-cron';
import type pino from 'pino';
import type { Config } from './config.js';
import { getTokenCostUsdtDrops } from './config.js';
import type { AuthService } from './api/auth.js';
import type { CreatorService } from './api/creator.js';
import type { TokenService } from './api/token.js';

const MIN_INTERVAL_MS = 5_000;

export class Scheduler {
  private creationTimer: ReturnType<typeof setTimeout> | null = null;
  private dailyCronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor(
    private readonly config: Config,
    private readonly authService: AuthService,
    private readonly creatorService: CreatorService,
    private readonly tokenService: TokenService,
    private readonly logger: pino.Logger,
  ) {}

  async start(): Promise<void> {
    this.logger.info('Starting scheduler...');

    await this.authService.login();
    await this.runDailyCycle();

    this.scheduleDailyReset();
    this.logger.info('Scheduler started. Waiting for next cycle...');
  }

  stop(): void {
    this.isRunning = false;
    if (this.creationTimer) {
      clearTimeout(this.creationTimer);
      this.creationTimer = null;
    }
    if (this.dailyCronJob) {
      this.dailyCronJob.stop();
      this.dailyCronJob = null;
    }
    this.logger.info('Scheduler stopped');
  }

  private scheduleDailyReset(): void {
    const cronExpression = `0 ${this.config.spreadStartHour} * * *`;

    this.dailyCronJob = cron.schedule(
      cronExpression,
      async () => {
        this.logger.info('Daily reset triggered');
        await this.runDailyCycle();
      },
      { timezone: this.config.timezone },
    );

    this.logger.info(
      { cron: cronExpression, timezone: this.config.timezone },
      'Daily reset scheduled',
    );
  }

  private async runDailyCycle(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Daily cycle already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const limits = await this.creatorService.getDailyLimits();

      if (!limits || limits.activePackagesCount === 0) {
        this.logger.error('No active creator packages found. Exiting.');
        this.stop();
        process.exit(1);
      }

      const remainingDrops = BigInt(limits.remainingDailyLimitUsdtDrops);
      const tokenCostDrops = getTokenCostUsdtDrops(this.config);
      const tokensToCreate = Number(remainingDrops / tokenCostDrops);

      if (tokensToCreate <= 0) {
        this.logger.info('Daily limit already fully used. Nothing to do.');
        this.isRunning = false;
        return;
      }

      const intervalMs = this.calculateInterval(tokensToCreate);

      this.logger.info(
        {
          tokensToCreate,
          intervalMinutes: (intervalMs / 60_000).toFixed(1),
          tokenCostUsdt: Number(tokenCostDrops) / 1_000_000,
        },
        'Starting token creation cycle',
      );

      await this.createTokensWithInterval(tokensToCreate, intervalMs);
    } catch (error) {
      this.logger.error({ err: error }, 'Daily cycle failed');
    } finally {
      this.isRunning = false;
    }
  }

  private calculateInterval(tokensToCreate: number): number {
    const now = new Date();
    const currentHour = this.getCurrentHour(now);

    const hoursRemaining = Math.max(this.config.spreadEndHour - currentHour, 0.5);
    const msRemaining = hoursRemaining * 60 * 60 * 1000;
    const calculatedInterval = Math.floor(msRemaining / tokensToCreate);

    if (calculatedInterval < MIN_INTERVAL_MS) {
      this.logger.warn(
        { calculatedIntervalMs: calculatedInterval },
        'Not enough time to spread evenly, using minimum interval',
      );
      return MIN_INTERVAL_MS;
    }

    return calculatedInterval;
  }

  private getCurrentHour(now: Date): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: this.config.timezone,
    });
    return parseInt(formatter.format(now), 10);
  }

  private async createTokensWithInterval(
    totalTokens: number,
    intervalMs: number,
  ): Promise<void> {
    let created = 0;

    for (let i = 0; i < totalTokens; i++) {
      if (!this.isRunning) {
        this.logger.info('Creation cycle interrupted');
        break;
      }

      try {
        await this.tokenService.createToken();
        created++;
        this.logger.info(
          { progress: `${created}/${totalTokens}` },
          'Token creation progress',
        );
      } catch (error) {
        this.logger.error(
          { err: error, progress: `${created}/${totalTokens}` },
          'Failed to create token, continuing...',
        );
      }

      if (i < totalTokens - 1 && this.isRunning) {
        await this.sleep(intervalMs);
      }
    }

    this.logger.info({ created, total: totalTokens }, 'Token creation cycle complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.creationTimer = setTimeout(resolve, ms);
    });
  }
}
