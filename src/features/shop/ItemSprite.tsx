import { objectSpriteKey } from '@/features/shared/sprites';
import { Sprite } from '@/features/shared/Sprite';
import { useTheme } from '@/theme/ThemeProvider';

export interface ItemSpriteProps {
  readonly object: Parameters<typeof objectSpriteKey>[1];
  readonly size: number;
  /** Empty when the name is already read beside it. */
  readonly label?: string;
  readonly testID?: string;
}

/** The sprite of an object of the shop; in Minimal the line icon takes the text of the theme. */
export function ItemSprite({ object, size, label = '', testID }: ItemSpriteProps) {
  const { colors, family } = useTheme();
  return (
    <Sprite
      spriteKey={objectSpriteKey(family, object)}
      size={size}
      label={label}
      ink={family === 'minimal' ? colors.text : undefined}
      testID={testID}
    />
  );
}
