import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { THEMES, type ThemeKey } from '@/theme/themes';
import { iconXml } from './icons';
import { Sprite } from './Sprite';
import { bossSpriteKey, type BossKind } from './sprites';

/** 32×32 at 3× (design-sezioni.md A5). */
const DEFAULT_SIZE = 96;
const CIRCLE_WIDTH = 2;

export interface BossSpriteProps {
  readonly kind: BossKind;
  /** The theme in use when missing; another one for previews. */
  readonly theme?: ThemeKey;
  readonly size?: number;
  readonly testID?: string;
}

/** The boss of a theme; Minimal has no sprites, so it draws a line icon in a circle. */
export function BossSprite({ kind, theme, size = DEFAULT_SIZE, testID }: BossSpriteProps) {
  const { t } = useTranslation();
  const active = useTheme();
  const { family, colors } = theme === undefined ? active : THEMES[theme];
  const spriteKey = bossSpriteKey(family, kind);
  if (spriteKey !== null) {
    return (
      <Sprite
        spriteKey={spriteKey}
        size={size}
        label={t(`shared.bossSprite.${family}.${kind}`)}
        testID={testID}
      />
    );
  }
  const goal = t('lexicon.boss', { context: family });
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        kind === 'quest'
          ? goal
          : t('shared.bossSprite.minimal', { goal, difficulty: t(`shared.difficulty.${kind}`) })
      }
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, borderColor: colors.boss },
      ]}
    >
      <SvgXml
        xml={iconXml('boss', family)}
        width={size / 2}
        height={size / 2}
        color={colors.boss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: CIRCLE_WIDTH },
});
