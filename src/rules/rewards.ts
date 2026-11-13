import { REWARD_SIZES, REWARDS } from './config';

// Personal rewards (analisi-funzionale.md US-NEG-03; xp-e-monete.md, section 2; design 7.6).

export type RewardSize = (typeof REWARD_SIZES)[number];

/** The price in coins of a size (CLAUDE.md, choice 22): never typed by hand. */
export function rewardPrice(size: RewardSize): number {
  if (!REWARD_SIZES.includes(size)) {
    throw new RangeError(`Unknown reward size: ${String(size)}`);
  }
  return REWARDS.prices[size];
}

/** The dots of the card, from 1 (small) to 4 (epic). */
export function rewardDots(size: RewardSize): number {
  rewardPrice(size);
  return REWARD_SIZES.indexOf(size) + 1;
}

/** The name of a reward without the spaces around it: required, up to 40 characters. */
export function rewardName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > REWARDS.nameMaxLength) {
    throw new RangeError(`A reward name has 1 to ${REWARDS.nameMaxLength} characters: ${name}`);
  }
  return trimmed;
}
