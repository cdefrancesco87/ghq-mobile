import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { PIXEL_SPRITES } from './generated/pixelSprites';
import { VECTOR_SVGS } from './generated/svgData';
import { spriteSide } from './sprites';

const PIXEL: Readonly<Record<string, (typeof PIXEL_SPRITES)[keyof typeof PIXEL_SPRITES]>> =
  PIXEL_SPRITES;
const VECTOR: Readonly<Record<string, string>> = VECTOR_SVGS;

/** The ink of the Minimal line art (the `testo` of Minimal light), drawn in the files. */
const MINIMAL_INK = '#1f2328';

export function hasSprite(spriteKey: string): boolean {
  return spriteKey in PIXEL || spriteKey in VECTOR;
}

export interface SpriteProps {
  /** The name of the file in assets/design/, without the extension. */
  readonly spriteKey: string;
  /** Side of the box: a pixel sprite takes the largest whole multiple of its grid that fits. */
  readonly size: number;
  /** What the screen reader says. */
  readonly label: string;
  /** Redraws the ink of a vector sprite in this colour: the text of Minimal dark. */
  readonly ink?: string;
  readonly testID?: string;
}

/** One sprite: a PNG already enlarged, or the SVG of the vector art of Minimal. */
export function Sprite({ spriteKey, size, label, ink, testID }: SpriteProps) {
  const pixel = PIXEL[spriteKey];
  const side = pixel === undefined ? size : spriteSide(pixel.grid, size);
  const vector = VECTOR[spriteKey] ?? null;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.box, { width: size, height: size }]}
    >
      {pixel === undefined ? (
        <SvgXml
          xml={ink === undefined ? vector : (vector?.replaceAll(MINIMAL_INK, ink) ?? null)}
          width={side}
          height={side}
        />
      ) : (
        <Image
          testID={testID === undefined ? undefined : `${testID}-image`}
          source={pixel.source}
          contentFit="fill"
          style={{ width: side, height: side }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
