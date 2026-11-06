import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// Line icons of the tab bar (design-sezioni.md A6). DRAFT: simple placeholder drawings; the base
// SVGs of the project assets replace them when they are copied into the app.

export type IconName = 'today' | 'habits' | 'new' | 'goals' | 'stats' | 'profile';

export interface IconProps {
  readonly name: IconName;
  readonly color: ColorValue;
  readonly size?: number;
}

export function Icon({ name, color, size = 24 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[name]}
    </Svg>
  );
}

const SHAPES: Record<IconName, React.JSX.Element> = {
  today: <Path d="M4 5h16v15H4zM4 10h16M8 3v4M16 3v4" />,
  habits: <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  new: <Path d="M12 5v14M5 12h14" />,
  goals: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={4} />
    </>
  ),
  stats: <Path d="M5 20V10M12 20V4M19 20v-7" />,
  profile: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
};
