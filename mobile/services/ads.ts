/**
 * Rewarded ads, as a provider abstraction.
 *
 * Ported from the website's `src/services/adService.ts`.
 *
 * JID's only monetisation is a listing boost: watch 2 rewarded ads to give a
 * listing 24 hours of elevated visibility. That is a revenue feature, not a
 * core feature, and shipping a fake provider would mean the app lies to its
 * users about a paid action. So:
 *
 *   - No ad network SDK is bundled. Adding one is a deliberate decision, not a
 *     default.
 *   - When no provider is configured, `getRewardedAdProvider()` returns null
 *     and the boost UI reports the feature as unavailable instead of granting
 *     a reward.
 *   - A `test` provider (a real, visible, timed 4-second ad) can be enabled
 *     locally with EXPO_PUBLIC_ADS_PROVIDER=test so the flow is exercisable
 *     during development.
 *
 * The contract below is deliberately the same shape as the website's, so
 * dropping in a real network SDK later is a one-file change.
 */

export interface RewardedAdProvider {
  readonly id: string;
  /** True once a cached ad is ready to be shown without latency. */
  isLoaded(): boolean;
  /** Warms the cache. Safe to call repeatedly. */
  preload(): void;
  /** Shows a rewarded ad and resolves true only if the user earned the reward. */
  show(): Promise<boolean>;
}

class TestRewardedAdProvider implements RewardedAdProvider {
  readonly id = 'test';

  private loaded = false;

  private timer: ReturnType<typeof setTimeout> | null = null;

  isLoaded(): boolean {
    return this.loaded;
  }

  preload(): void {
    if (this.timer) clearTimeout(this.timer);
    this.loaded = false;
    // A short fake load delay, so calling code that gates on `isLoaded()`
    // behaves the same as it would with a real SDK.
    this.timer = setTimeout(() => {
      this.loaded = true;
    }, 600);
  }

  async show(): Promise<boolean> {
    this.loaded = false;
    // 4 seconds of "ad". The caller renders the countdown itself, so all this
    // needs to do is resolve after that long.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 4000);
    });
    this.preload();
    return true;
  }
}

const providerMap: Record<string, () => RewardedAdProvider> = {
  test: () => new TestRewardedAdProvider(),
};

let instance: RewardedAdProvider | null | undefined;

export function getRewardedAdProvider(): RewardedAdProvider | null {
  if (instance !== undefined) return instance;
  const id = process.env.EXPO_PUBLIC_ADS_PROVIDER;
  const factory = id ? providerMap[id] : undefined;
  instance = factory ? factory() : null;
  return instance;
}

/** Whether the boost flow can run at all in this build. */
export const boostsAvailable = (): boolean => getRewardedAdProvider() !== null;