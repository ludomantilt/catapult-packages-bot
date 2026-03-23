export const AUTH_LOGIN_EVM = `
  mutation AuthLoginEvm($input: LoginInput!) {
    authLoginEvm(input: $input) {
      accessToken
    }
  }
`;

export const CREATOR_DAILY_LIMITS = `
  query TurboCreatorDailyLimits {
    turboCreatorDailyLimits {
      activePackagesCount
      carryoverUsdtDrops
      dailyLimitUsdtDrops
      remainingDailyLimitUsdtDrops
      usedTodayUsdtDrops
    }
  }
`;

export const TOKEN_RANDOMIZED_PRESET = `
  query TurboTokenRandomizedPreset($allowedValues: TurboTokenPresetAllowedValuesInput) {
    turboTokenRandomizedPreset(allowedValues: $allowedValues) {
      avatarUrl
      description
      fileId
      name
      priceMode
      rank
      speedMode
      symbol
      turboTokenMode
      xLink
    }
  }
`;

export const TOKEN_CREATE = `
  mutation TurboTokenCreate($input: CreateTurboTokenInput!) {
    turboTokenCreate(input: $input)
  }
`;

