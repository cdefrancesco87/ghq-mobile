// Contrast between two colours, with the formulas of WCAG 2.x: text needs at least 4.5:1
// (design-sezioni.md, A4).

const HEX_COLOUR = /^#([0-9a-f]{6})$/i;

/** Relative luminance of a `#rrggbb` colour, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const match = HEX_COLOUR.exec(hex);
  if (!match) {
    throw new RangeError(`Expected a colour as #rrggbb: ${hex}`);
  }
  const value = parseInt(match[1], 16);
  const [red, green, blue] = [value >> 16, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Contrast ratio between two colours, from 1 (same colour) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mixes two colours: 0 gives `from`, 1 gives `to`. */
export function mixColours(from: string, to: string, amount: number): string {
  const channels = (hex: string) => {
    relativeLuminance(hex);
    const value = parseInt(hex.slice(1), 16);
    return [value >> 16, (value >> 8) & 0xff, value & 0xff];
  };
  const start = channels(from);
  const end = channels(to);
  const mixed = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * amount),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
