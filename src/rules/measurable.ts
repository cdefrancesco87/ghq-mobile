import { MEASURABLE } from './config';

// Helpers of the measurable missions (design-sezioni.md 4.7; US-EDT-03). Pure functions.

/** Removes the noise of floating point sums, e.g. 0.30000000000000004. */
function tidy(value: number): number {
  return Number(value.toPrecision(12));
}

/**
 * The increment proposed for one tap: about an eighth of the target, rounded to a handy number
 * (1, 2, 2.5 or 5 times a power of ten), at least 1 for whole units (pages, times) and never
 * more than the target. Null when the target is missing or wrong.
 */
export function suggestIncrement(target: number, wholeUnits: boolean): number | null {
  if (!Number.isFinite(target) || target <= 0) {
    return null;
  }
  const wanted = target * MEASURABLE.incrementShareOfTarget;
  const power = 10 ** Math.floor(Math.log10(wanted));
  let best = power;
  for (const base of MEASURABLE.handySteps) {
    for (const scale of [power / 10, power, power * 10]) {
      const candidate = tidy(base * scale);
      if (Math.abs(Math.log(candidate / wanted)) < Math.abs(Math.log(best / wanted))) {
        best = candidate;
      }
    }
  }
  const whole = wholeUnits ? Math.max(1, Math.round(best)) : best;
  return tidy(Math.min(whole, target));
}

/** A positive amount typed by the user, with a dot or a comma as decimal separator. */
export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized) && !/^\d*\.\d+$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}
