import { useTranslation } from 'react-i18next';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { VECTOR_SVGS } from './generated/svgData';
import { LOGO_PLACEHOLDERS } from './placeholders';

export interface LogoProps {
  readonly variant: keyof typeof LOGO_PLACEHOLDERS;
  readonly height: number;
  readonly testID?: string;
}

/** The logo of the app, a placeholder for now (`placeholders.ts`). */
export function Logo({ variant, height, testID }: LogoProps) {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const logo = LOGO_PLACEHOLDERS[variant];
  return (
    <SvgXml
      testID={testID}
      xml={VECTOR_SVGS[dark ? logo.dark : logo.light]}
      width={height * logo.ratio}
      height={height}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('shared.appName')}
    />
  );
}
