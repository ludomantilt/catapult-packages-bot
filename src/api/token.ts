import type pino from 'pino';
import type { Config } from '../config.js';
import type { GraphQLClient } from './client.js';
import { TOKEN_RANDOMIZED_PRESET, TOKEN_CREATE } from './queries.js';

export interface TokenPreset {
  avatarUrl: string;
  description: string | null;
  fileId: string;
  name: string;
  priceMode: string;
  rank: string;
  speedMode: string;
  symbol: string;
  turboTokenMode: string;
  xLink: string | null;
}

interface PresetResponse {
  turboTokenRandomizedPreset: TokenPreset;
}

interface CreateTokenResponse {
  turboTokenCreate: string;
}

export class TokenService {
  constructor(
    private readonly client: GraphQLClient,
    private readonly config: Config,
    private readonly logger: pino.Logger,
  ) {}

  async getRandomizedPreset(): Promise<TokenPreset> {
    const response = await this.client.request<PresetResponse>(
      TOKEN_RANDOMIZED_PRESET,
      {
        allowedValues: {
          rank: [this.config.tokenRank],
          turboTokenMode: [this.config.tokenMode],
          priceMode: [this.config.tokenPriceMode],
        },
      },
      "TurboTokenRandomizedPreset",
    );

    const preset = response.turboTokenRandomizedPreset;
    this.logger.debug({ name: preset.name, symbol: preset.symbol }, 'Got randomized preset');
    return preset;
  }

  async createToken(): Promise<string> {
    const preset = await this.getRandomizedPreset();

    this.logger.info(
      { name: preset.name, symbol: preset.symbol, mode: preset.turboTokenMode, rank: preset.rank },
      'Creating token...',
    );

    const input: Record<string, string> = {
      name: preset.name,
      symbol: preset.symbol,
      fileId: preset.fileId,
      rank: preset.rank,
      turboTokenMode: preset.turboTokenMode,
      priceMode: preset.priceMode,
      paymentType: 'Credits',
    };

    if (preset.description) {
      input['description'] = preset.description;
    }

    const response = await this.client.request<CreateTokenResponse>(
      TOKEN_CREATE,
      { input },
      "TurboTokenCreate",
    );

    const tokenId = response.turboTokenCreate;
    const tokenUrl = `https://catapult.trade/turbo/tokens/${tokenId}`;
    this.logger.info({ tokenId, name: preset.name, symbol: preset.symbol, url: tokenUrl }, 'Token created');
    return tokenId;
  }
}
