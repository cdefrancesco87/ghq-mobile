import type { ThemeFamily } from './themes';

// The shapes of the themes (misure-componenti.md, table of the approved measures; temi.json v2,
// `forma`). Colours stay in the roles: this file says only how a surface is drawn.

/** How the border of a surface is drawn. */
export type FrameShape =
  | {
      readonly kind: 'rounded';
      readonly radius: number;
      readonly borderWidth: number;
      /** Distance of a second thin rule inside the border (Fantasy and Lovecraft cards). */
      readonly innerRuleAt?: number;
    }
  /** A pixel frame: four bars with the corners left empty, so that they look stepped. */
  | { readonly kind: 'pixel'; readonly width: number }
  /** Corners cut at top left and bottom right, drawn as an SVG path (correction 7). */
  | { readonly kind: 'cut'; readonly cut: number; readonly borderWidth: number };

export interface BarShape {
  readonly height: number;
  readonly radius: number;
  /** Border of the track, in `textMuted`. */
  readonly outlineWidth: number;
  /** Segments of a fixed width (as many as fit) or a fixed number of them; `null` is continuous. */
  readonly segments:
    | { readonly kind: 'fixed'; readonly width: number; readonly gap: number }
    | { readonly kind: 'count'; readonly count: number; readonly gap: number }
    | null;
  /** Blur of the glow around the full segments. */
  readonly glow: number;
}

/** The stroke of the line icons (`docs/mockup/asset/lotto1/linea/`, one per theme). */
export interface IconStroke {
  readonly width: number;
  readonly linecap: 'round' | 'square';
  readonly linejoin: 'round' | 'miter';
}

export interface ThemeShapes {
  readonly icon: IconStroke;
  readonly card: FrameShape;
  /** Buttons, fields and the segmented control. */
  readonly control: FrameShape;
  readonly chip: FrameShape;
  /** Sheets from the bottom: only the top edge is drawn. */
  readonly sheet: FrameShape;
  readonly bar: BarShape;
}

/** Radius of a pill: larger than any height the text can reach. */
const PILL = 999;

export const SHAPES: Readonly<Record<ThemeFamily, ThemeShapes>> = {
  minimal: {
    icon: { width: 1.75, linecap: 'round', linejoin: 'round' },
    card: { kind: 'rounded', radius: 18, borderWidth: 1 },
    control: { kind: 'rounded', radius: 14, borderWidth: 1 },
    chip: { kind: 'rounded', radius: PILL, borderWidth: 1 },
    sheet: { kind: 'rounded', radius: 18, borderWidth: 0 },
    bar: { height: 8, radius: 4, outlineWidth: 0, segments: null, glow: 0 },
  },
  arcade: {
    // DRAFT: Arcade has pixel icons; this stroke is only for the placeholders without one.
    icon: { width: 2, linecap: 'square', linejoin: 'miter' },
    card: { kind: 'pixel', width: 3 },
    control: { kind: 'pixel', width: 2 },
    chip: { kind: 'pixel', width: 2 },
    sheet: { kind: 'pixel', width: 3 },
    bar: {
      height: 12,
      radius: 0,
      outlineWidth: 0,
      segments: { kind: 'fixed', width: 8, gap: 2 },
      glow: 0,
    },
  },
  fantasy: {
    icon: { width: 1.5, linecap: 'round', linejoin: 'round' },
    card: { kind: 'rounded', radius: 8, borderWidth: 1, innerRuleAt: 3 },
    control: { kind: 'rounded', radius: 8, borderWidth: 1 },
    chip: { kind: 'rounded', radius: 8, borderWidth: 1 },
    sheet: { kind: 'rounded', radius: 8, borderWidth: 0 },
    bar: { height: 10, radius: 5, outlineWidth: 1, segments: null, glow: 0 },
  },
  cyberpunk: {
    icon: { width: 1.75, linecap: 'square', linejoin: 'miter' },
    card: { kind: 'cut', cut: 12, borderWidth: 1 },
    control: { kind: 'cut', cut: 8, borderWidth: 1 },
    chip: { kind: 'cut', cut: 6, borderWidth: 1 },
    sheet: { kind: 'cut', cut: 12, borderWidth: 1 },
    bar: {
      height: 6,
      radius: 0,
      outlineWidth: 0,
      segments: { kind: 'count', count: 20, gap: 2 },
      glow: 4,
    },
  },
  lovecraft: {
    icon: { width: 1.25, linecap: 'round', linejoin: 'round' },
    card: { kind: 'rounded', radius: 0, borderWidth: 1, innerRuleAt: 3 },
    control: { kind: 'rounded', radius: 0, borderWidth: 1 },
    chip: { kind: 'rounded', radius: 0, borderWidth: 1 },
    sheet: { kind: 'rounded', radius: 0, borderWidth: 1, innerRuleAt: 3 },
    bar: { height: 4, radius: 0, outlineWidth: 0, segments: null, glow: 0 },
  },
};

/** The dimmed layer behind sheets and dialogs: the same in every theme, it is not a colour role. */
export const SCRIM = 'rgba(0, 0, 0, 0.45)';
