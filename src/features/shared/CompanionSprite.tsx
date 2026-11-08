import { useTranslation } from 'react-i18next';

import type { CompanionStage } from '@/rules/companion';
import { useTheme } from '@/theme/ThemeProvider';
import { THEMES, type ThemeKey } from '@/theme/themes';
import { Sprite } from './Sprite';
import { companionSpriteKey, type CompanionPose } from './sprites';

/** 32×32 at 3× (design-sezioni.md A5). */
const DEFAULT_SIZE = 96;

export interface CompanionSpriteProps {
  readonly stage: CompanionStage;
  /** The egg has only one drawing, so it ignores the mood. */
  readonly mood: CompanionPose;
  /** The theme in use when missing; another one for previews. */
  readonly theme?: ThemeKey;
  readonly size?: number;
  readonly testID?: string;
}

/** The companion of a theme, described to the screen reader («Pixel, cucciolo, felice»). */
export function CompanionSprite({
  stage,
  mood,
  theme,
  size = DEFAULT_SIZE,
  testID,
}: CompanionSpriteProps) {
  const { t } = useTranslation();
  const active = useTheme();
  const key = theme ?? active.key;
  const name = t('lexicon.companion', { context: THEMES[key].family });
  const stageWord = t(`shared.companionSprite.stage.${stage}`);
  const label =
    stage === 'egg'
      ? t('shared.companionSprite.egg', { name, stage: stageWord })
      : t('shared.companionSprite.grown', {
          name,
          stage: stageWord,
          mood: t(`shared.companionSprite.mood.${mood}`),
        });
  return (
    <Sprite
      spriteKey={companionSpriteKey(key, stage, mood)}
      size={size}
      label={label}
      testID={testID}
    />
  );
}
