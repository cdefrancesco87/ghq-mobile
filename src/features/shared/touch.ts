import { Platform } from 'react-native';

/** The minimum touch area: 44 points on iOS, 48 dp on Android (design-sezioni.md A2). */
export const MIN_TOUCH = Platform.select({ ios: 44, default: 48 });

/** The extra touch area above and below a control shorter than the minimum. */
export function hitSlopFor(height: number) {
  const slop = Math.max(0, Math.ceil((MIN_TOUCH - height) / 2));
  return { top: slop, bottom: slop };
}
