import { SHAPES } from '@/theme/shapes';
import type { ThemeFamily } from '@/theme/themes';
import { LINE_ICON_BODIES, PIXEL_ICON_BODIES } from './generated/svgData';

// The icons of design-sezioni.md A5. Their names are those of the files in assets/design/lotto1/.

export type IconName = keyof typeof LINE_ICON_BODIES | keyof typeof PIXEL_ICON_BODIES;

/** The body sizes of A5: 24 in the tab bar and headers, 20 in rows, 16 in chips. */
export type IconSize = 24 | 20 | 16;

type Bodies = Readonly<Record<string, string | undefined>>;

const LINE: Bodies = LINE_ICON_BODIES;
const PIXEL: Bodies = PIXEL_ICON_BODIES;

/** Every icon of the app. */
export const ICON_NAMES = [...new Set([...Object.keys(LINE), ...Object.keys(PIXEL)])] as IconName[];

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"';

function lineXml(body: string, family: ThemeFamily): string {
  const { width, linecap, linejoin } = SHAPES[family].icon;
  return `${SVG} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="${linecap}" stroke-linejoin="${linejoin}">${body}</svg>`;
}

function pixelXml(body: string): string {
  return `${SVG} viewBox="0 0 12 12" fill="currentColor">${body}</svg>`;
}

/**
 * The SVG of an icon, in `currentColor`: Arcade prefers the pixel drawing and the other themes the
 * line drawing; when an icon has only one of the two, every theme shows that one.
 */
export function iconXml(name: IconName, family: ThemeFamily): string {
  const line = LINE[name];
  const pixel = PIXEL[name];
  if (pixel !== undefined && (family === 'arcade' || line === undefined)) {
    return pixelXml(pixel);
  }
  return lineXml(line as string, family);
}
