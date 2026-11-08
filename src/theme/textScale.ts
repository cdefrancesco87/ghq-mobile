/** From this font scale on, the large-text layouts apply (design-sezioni.md A11.1). */
export const LARGE_TEXT_SCALE = 1.3;

/** Titles and Display stop at 150% (design-sezioni.md A3). */
export const MAX_TITLE_SCALE = 1.5;

/** Body, labels, numbers and captions stop at 200% (design-sezioni.md A3). */
export const MAX_TEXT_SCALE = 2;

/**
 * The size of Press Start 2P at a font scale: it stays sharp only at multiples of 2, so a larger
 * size is rounded down to one, without going below the size of the theme (A3 and A11.1).
 */
export function pixelFontSize(fontSize: number, fontScale: number, maxScale: number): number {
  const scaled = fontSize * Math.min(fontScale, maxScale);
  return Math.max(fontSize, Math.floor(scaled / 2) * 2);
}
