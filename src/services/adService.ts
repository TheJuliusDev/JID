/**
 * Rewarded-ads abstraction for the "watch ads → boost listing" flow (the ONLY
 * monetization in JID — there is no Premium, no subscription, no paid checkout).
 *
 * A concrete ad network is plugged in at runtime via `registerRewardedAdProvider`
 * (or the built-in opt-in test provider). If no provider is configured the flow
 * reports itself unavailable — it NEVER fabricates a completed ad. A boost reward
 * is granted only after the provider confirms every required ad was watched.
 */
import { readEnv } from '../config/env';
import { BRAND_CONFIG } from '../config/brand';

export interface RewardedAdResult {
  /** True only when the user watched the ad through to the rewarded checkpoint. */
  rewarded: boolean;
}

export interface RewardedAdProvider {
  name: string;
  /** Preload the next ad. May be a no-op. */
  load(): Promise<void>;
  /** Present one rewarded ad; resolves when it closes. */
  show(): Promise<RewardedAdResult>;
}

const REQUIRED_ADS = BRAND_CONFIG.boostRules.requiredAdsCount;

let provider: RewardedAdProvider | null = null;

/** Wire in a real ad network (e.g. AdMob / IronSource / a rewarded web SDK). */
export function registerRewardedAdProvider(p: RewardedAdProvider) {
  provider = p;
}

/**
 * Opt-in test provider. Activated ONLY when EXPO_PUBLIC_ADS_PROVIDER=test.
 * It still requires real elapsed watch time — it does not instantly grant a
 * reward — and is never active in a normal production build.
 */
function maybeInstallTestProvider() {
  if (provider) return;
  const mode = readEnv('ADS_PROVIDER');
  if (mode !== 'test') return;
  provider = {
    name: 'test',
    load: async () => {},
    show: () =>
      new Promise<RewardedAdResult>((resolve) => {
        // Simulate a short rewarded ad that must actually elapse.
        setTimeout(() => resolve({ rewarded: true }), 4000);
      }),
  };
}

/** Whether a rewarded-ad provider is available. Boosting is blocked when false. */
export function isRewardedAdsAvailable(): boolean {
  maybeInstallTestProvider();
  return provider !== null;
}

export function requiredAdsCount(): number {
  return REQUIRED_ADS;
}

export async function loadRewardedAd(): Promise<void> {
  maybeInstallTestProvider();
  if (!provider) throw new Error('No rewarded-ad provider configured.');
  await provider.load();
}

export async function showRewardedAd(): Promise<RewardedAdResult> {
  maybeInstallTestProvider();
  if (!provider) throw new Error('No rewarded-ad provider configured.');
  return provider.show();
}

/**
 * Run the full boost ad sequence: the user must watch `REQUIRED_ADS` ads to
 * completion. Progress is reported after each confirmed ad. Resolves true only
 * if every ad was genuinely rewarded — the caller must not grant a boost otherwise.
 */
export async function watchAdsForBoost(onProgress?: (watched: number, total: number) => void): Promise<boolean> {
  maybeInstallTestProvider();
  if (!provider) return false;

  let watched = 0;
  onProgress?.(0, REQUIRED_ADS);
  for (let i = 0; i < REQUIRED_ADS; i += 1) {
    await provider.load();
    const result = await provider.show();
    if (!result.rewarded) {
      return false; // user skipped / closed early — no reward
    }
    watched += 1;
    onProgress?.(watched, REQUIRED_ADS);
  }
  return watched === REQUIRED_ADS;
}
