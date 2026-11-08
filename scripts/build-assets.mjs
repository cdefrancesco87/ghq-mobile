// Builds what the app needs from the design SVGs in assets/design/:
// - assets/sprites/*.png: the pixel sprites, already enlarged with nearest-neighbour
//   (stack-tecnologico.md, point 8);
// - src/features/shared/generated/: the SVG data of icons and vector art, without metadata, and
//   the static `require` of each PNG.
// Run it with `node scripts/build-assets.mjs` after copying new assets into assets/design/.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const DESIGN = 'assets/design';
const SPRITES = 'assets/sprites';
const GENERATED = 'src/features/shared/generated';

/** The longest side of a PNG, at least: enough for a 128 pt sprite on a 3.5× screen. */
const MIN_PNG_SIDE = 512;

const svgNames = (folder) =>
  readdirSync(join(DESIGN, folder))
    .filter((file) => file.endsWith('.svg'))
    .sort()
    .map((file) => join(folder, file));

const readSvg = (path) => readFileSync(join(DESIGN, path), 'utf8');

function withoutMetadata(svg) {
  return svg
    .replace(/<metadata>[\s\S]*?<\/metadata>/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/ xmlns:c2pa="[^"]*"/, '')
    .trim();
}

const bodyOf = (svg) =>
  withoutMetadata(svg)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');

function attribute(tag, name) {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** The pixels of a sprite: only whole-pixel `rect`s with a solid colour, or it stops. */
function pixelsOf(path, svg) {
  const clean = withoutMetadata(svg);
  const [, width, height] = /viewBox="0 0 (\d+) (\d+)"/.exec(clean) ?? [];
  if (width === undefined || width !== height) {
    throw new Error(`${path}: the sprite is not square`);
  }
  const side = Number(width);
  const pixels = new Uint8Array(side * side * 4);
  const shapes = clean.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const rects = shapes.match(/<rect\b[^>]*\/>/g) ?? [];
  if (rects.join('') !== shapes) {
    throw new Error(`${path}: only rects can become a PNG`);
  }
  for (const rect of rects) {
    const fill = attribute(rect, 'fill');
    if (!/^#[0-9a-f]{6}$/i.test(fill ?? '') || attribute(rect, 'opacity') !== undefined) {
      throw new Error(`${path}: unexpected colour in ${rect}`);
    }
    const color = [1, 3, 5].map((start) => parseInt(fill.slice(start, start + 2), 16));
    const x = Number(attribute(rect, 'x') ?? 0);
    const y = Number(attribute(rect, 'y') ?? 0);
    const w = Number(attribute(rect, 'width'));
    const h = Number(attribute(rect, 'height'));
    if (![x, y, w, h].every(Number.isInteger) || x + w > side || y + h > side) {
      throw new Error(`${path}: rect outside the grid: ${rect}`);
    }
    for (let row = y; row < y + h; row += 1) {
      for (let column = x; column < x + w; column += 1) {
        pixels.set([...color, 255], (row * side + column) * 4);
      }
    }
  }
  return { side, pixels };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** An RGBA PNG, with every sprite pixel repeated `scale` times (nearest-neighbour). */
function encodePng({ side, pixels }, scale) {
  const size = side * scale;
  const row = 1 + size * 4;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const from = (Math.floor(y / scale) * side + Math.floor(x / scale)) * 4;
      raw.set(pixels.subarray(from, from + 4), y * row + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA, no interlacing
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const stem = (path) => basename(path, '.svg');
const literal = (entries) =>
  `{\n${entries.map(([key, value]) => `  ${JSON.stringify(key)}: ${value},`).join('\n')}\n}`;

const lineIcons = svgNames('lotto1/linea')
  .filter((path) => path.endsWith('-minimal.svg'))
  .map((path) => [
    stem(path)
      .replace(/^icona-/, '')
      .replace(/-minimal$/, ''),
    path,
  ]);
// Only the Minimal file is kept: the same drawing, with the stroke of the theme from shapes.ts.
for (const [, path] of lineIcons) {
  for (const family of ['fantasy', 'cyberpunk', 'lovecraft']) {
    if (bodyOf(readSvg(path.replace('-minimal', `-${family}`))) !== bodyOf(readSvg(path))) {
      throw new Error(`${path}: the ${family} drawing is different`);
    }
  }
}
const pixelIcons = svgNames('lotto1/pixel').map((path) => [
  stem(path)
    .replace(/^icona-/, '')
    .replace(/-arcade$/, ''),
  path,
]);

const isSprite = (path) => /^(boss|compagno)-/.test(stem(path));
const spritePaths = [...svgNames('lotto3'), ...svgNames('lotto8')].filter(isSprite);
const isVector = (path) => stem(path).includes('minimal');
const logos = svgNames('lotto4').filter((path) => stem(path).startsWith('logo-'));
const vectors = [...spritePaths.filter(isVector), ...logos];

rmSync(SPRITES, { recursive: true, force: true });
mkdirSync(SPRITES, { recursive: true });
mkdirSync(GENERATED, { recursive: true });

const sprites = spritePaths
  .filter((path) => !isVector(path))
  .map((path) => {
    const pixels = pixelsOf(path, readSvg(path));
    const scale = Math.ceil(MIN_PNG_SIDE / pixels.side);
    writeFileSync(join(SPRITES, `${stem(path)}.png`), encodePng(pixels, scale));
    const source = `require('../../../../${SPRITES}/${stem(path)}.png')`;
    return [stem(path), `{ source: ${source}, grid: ${pixels.side} }`];
  });

const NOTE = '// GENERATED by scripts/build-assets.mjs from assets/design/: do not edit.\n';

writeFileSync(
  join(GENERATED, 'svgData.ts'),
  `${NOTE}
/** Inner SVG of the line icons, viewBox 24: the stroke comes from the theme. */
export const LINE_ICON_BODIES = ${literal(
    lineIcons.map(([name, path]) => [name, JSON.stringify(bodyOf(readSvg(path)))]),
  )} as const;

/** Inner SVG of the pixel icons of Arcade, viewBox 12, in \`currentColor\`. */
export const PIXEL_ICON_BODIES = ${literal(
    pixelIcons.map(([name, path]) => [name, JSON.stringify(bodyOf(readSvg(path)))]),
  )} as const;

/** Complete SVGs of the vector art: the Minimal companion and the logo. */
export const VECTOR_SVGS = ${literal(
    vectors.map((path) => [stem(path), JSON.stringify(withoutMetadata(readSvg(path)))]),
  )} as const;
`,
);

writeFileSync(
  join(GENERATED, 'pixelSprites.ts'),
  `${NOTE}import type { ImageSourcePropType } from 'react-native';

/** The enlarged PNG of each pixel sprite and the side of its original grid. */
export const PIXEL_SPRITES = ${literal(sprites)} as const satisfies Readonly<
  Record<string, { readonly source: ImageSourcePropType; readonly grid: number }>
>;
`,
);

console.log(`${sprites.length} PNG, ${vectors.length} vector SVG, ${lineIcons.length} line icons`);
