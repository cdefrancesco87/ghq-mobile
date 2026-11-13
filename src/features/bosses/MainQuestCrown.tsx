import { useTranslation } from 'react-i18next';

import { Sprite } from '@/features/shared/Sprite';
import { crownSpriteKey } from '@/features/shared/sprites';
import { useTheme } from '@/theme/ThemeProvider';

/** 16×16 at 2× in the pixel themes; the line icon of Minimal at the same size. */
export const CROWN_SIZE = 32;

/**
 * The crown of the Main Quest (design-sezioni.md 5.8; lotto 8): the sprite of the theme, in
 * Minimal the line icon in the colour of the text. The screen reader says «Main Quest».
 */
export function MainQuestCrown({ testID, size = CROWN_SIZE }: { testID?: string; size?: number }) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  return (
    <Sprite
      spriteKey={crownSpriteKey(family)}
      size={size}
      label={t('bosses.main.crown')}
      ink={family === 'minimal' ? colors.text : undefined}
      testID={testID}
    />
  );
}
