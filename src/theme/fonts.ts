import { Alegreya_400Regular } from '@expo-google-fonts/alegreya/400Regular';
import { Alegreya_400Regular_Italic } from '@expo-google-fonts/alegreya/400Regular_Italic';
import { Alegreya_500Medium } from '@expo-google-fonts/alegreya/500Medium';
import { ChakraPetch_400Regular } from '@expo-google-fonts/chakra-petch/400Regular';
import { ChakraPetch_600SemiBold } from '@expo-google-fonts/chakra-petch/600SemiBold';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch/700Bold';
import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { CrimsonPro_400Regular } from '@expo-google-fonts/crimson-pro/400Regular';
import { CrimsonPro_400Regular_Italic } from '@expo-google-fonts/crimson-pro/400Regular_Italic';
import { CrimsonPro_600SemiBold } from '@expo-google-fonts/crimson-pro/600SemiBold';
import { IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p/400Regular';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono/400Regular';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';
import type { TextStyle } from 'react-native';

import type { TextStyleToken } from './themes';

// The fonts of the themes (design-temi.md, «Caratteri»; design-sezioni.md A3), bundled with the
// app so they work offline. Only the weights used by the theme tokens are included: every weight
// is a file, and the unused ones would only make the app heavier.

/** The font files, by the name that the styles use (loaded with expo-font at start-up). */
export const FONT_FILES = {
  Alegreya_400Regular,
  Alegreya_400Regular_Italic,
  Alegreya_500Medium,
  ChakraPetch_400Regular,
  ChakraPetch_600SemiBold,
  ChakraPetch_700Bold,
  Cinzel_600SemiBold,
  Cinzel_700Bold,
  CrimsonPro_400Regular,
  CrimsonPro_400Regular_Italic,
  CrimsonPro_600SemiBold,
  IMFellEnglishSC_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  PressStart2P_400Regular,
  ShareTechMono_400Regular,
  VT323_400Regular,
} as const;

export type FontName = keyof typeof FONT_FILES;

const WEIGHT_NAMES: Record<TextStyleToken['fontWeight'], string> = {
  '400': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
  '800': 'ExtraBold',
};

/**
 * The loaded font of a text style. With custom fonts weight and italic are part of the name
 * («Manrope 800» is `Manrope_800ExtraBold`), so the styles never set fontWeight or fontStyle.
 */
export function fontNameOf(style: TextStyleToken): FontName {
  const family = style.fontFamily.replace(/ /g, '');
  const name = `${family}_${style.fontWeight}${WEIGHT_NAMES[style.fontWeight]}${style.italic ? '_Italic' : ''}`;
  if (!(name in FONT_FILES)) {
    throw new Error(`The font ${name} is not bundled with the app`);
  }
  return name as FontName;
}

/** A React Native text style from a typographic role of the theme. */
export function textStyleOf(style: TextStyleToken): TextStyle {
  return {
    fontFamily: fontNameOf(style),
    fontSize: style.fontSize,
    letterSpacing: style.letterSpacing,
    textTransform: style.uppercase ? 'uppercase' : 'none',
    fontVariant: style.tabularNums ? ['lining-nums', 'tabular-nums'] : [],
  };
}
