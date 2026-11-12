import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { FrameShape } from '@/theme/shapes';

// The background of cards, buttons, chips and sheets, drawn in the shape of the theme. It fills
// its parent and lets the touches through, so a component only adds its content on top.

export interface FrameProps {
  readonly shape: FrameShape;
  readonly fill: string;
  readonly stroke: string;
  /** `top` draws only the top edge, for a surface that touches the bottom of the screen. */
  readonly edge?: 'all' | 'top';
  readonly testID?: string;
}

export function Frame({ shape, ...props }: FrameProps) {
  switch (shape.kind) {
    case 'rounded':
      return <RoundedFrame shape={shape} {...props} />;
    case 'pixel':
      return <PixelFrame shape={shape} {...props} />;
    case 'cut':
      return <CutFrame shape={shape} {...props} />;
  }
}

type FramePropsOf<Kind extends FrameShape['kind']> = Omit<FrameProps, 'shape'> & {
  readonly shape: Extract<FrameShape, { kind: Kind }>;
};

function RoundedFrame({ shape, fill, stroke, edge = 'all', testID }: FramePropsOf<'rounded'>) {
  const { radius, borderWidth, innerRuleAt } = shape;
  if (edge === 'top') {
    return (
      <View
        testID={testID}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: fill,
            borderColor: stroke,
            borderTopWidth: borderWidth,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
          },
        ]}
      >
        {innerRuleAt === undefined ? null : (
          <View style={[styles.rule, { top: innerRuleAt, backgroundColor: stroke }]} />
        )}
      </View>
    );
  }
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: fill, borderColor: stroke, borderWidth, borderRadius: radius },
      ]}
    >
      {innerRuleAt === undefined ? null : (
        <View
          testID={testID === undefined ? undefined : `${testID}-rule`}
          style={{
            position: 'absolute',
            top: innerRuleAt,
            left: innerRuleAt,
            right: innerRuleAt,
            bottom: innerRuleAt,
            borderWidth: 1,
            borderColor: stroke,
            borderRadius: Math.max(radius - innerRuleAt - borderWidth, 0),
          }}
        />
      )}
    </View>
  );
}

function PixelFrame({ shape, fill, stroke, edge = 'all', testID }: FramePropsOf<'pixel'>) {
  const { width } = shape;
  const barID = testID === undefined ? undefined : `${testID}-bar`;
  if (edge === 'top') {
    return (
      <View testID={testID} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: 'absolute',
            top: width,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: fill,
          }}
        />
        <View
          testID={barID}
          style={{
            position: 'absolute',
            top: 0,
            left: width,
            right: width,
            height: width,
            backgroundColor: stroke,
          }}
        />
      </View>
    );
  }
  const bars = [
    { top: 0, left: width, right: width, height: width },
    { bottom: 0, left: width, right: width, height: width },
    { left: 0, top: width, bottom: width, width },
    { right: 0, top: width, bottom: width, width },
  ];
  return (
    <View testID={testID} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          top: width,
          left: width,
          right: width,
          bottom: width,
          backgroundColor: fill,
        }}
      />
      {bars.map((bar, index) => (
        <View
          key={index}
          testID={barID}
          style={[{ position: 'absolute', backgroundColor: stroke }, bar]}
        />
      ))}
    </View>
  );
}

/** The outline of a surface with two cut corners, inset so that the stroke is not clipped. */
export function cutFramePath(
  width: number,
  height: number,
  cut: number,
  borderWidth: number,
): string {
  const inset = borderWidth / 2;
  const right = width - inset;
  const bottom = height - inset;
  return [
    `M${cut} ${inset}`,
    `L${right} ${inset}`,
    `L${right} ${bottom - cut}`,
    `L${right - cut} ${bottom}`,
    `L${inset} ${bottom}`,
    `L${inset} ${cut}`,
    'Z',
  ].join(' ');
}

/** The surface of a cut sheet: only the top left corner is cut, the rest reaches the edges. */
export function cutSheetFillPath(width: number, height: number, cut: number): string {
  return `M${cut} 0 L${width} 0 L${width} ${height} L0 ${height} L0 ${cut} Z`;
}

/** The top edge of a cut sheet, the only part of its border that is drawn. */
export function cutSheetStrokePath(width: number, cut: number, borderWidth: number): string {
  const inset = borderWidth / 2;
  return `M0 ${cut + inset} L${cut} ${inset} L${width} ${inset}`;
}

function CutFrame({ shape, fill, stroke, edge = 'all', testID }: FramePropsOf<'cut'>) {
  const { cut, borderWidth } = shape;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      {size === null ? null : (
        // Not the measured numbers: react-native-svg truncates them, and at a width that is not
        // whole the view would end before the right edge of the path.
        <Svg width="100%" height="100%">
          {edge === 'top' ? (
            <>
              <Path d={cutSheetFillPath(size.width, size.height, cut)} fill={fill} />
              <Path
                d={cutSheetStrokePath(size.width, cut, borderWidth)}
                fill="none"
                stroke={stroke}
                strokeWidth={borderWidth}
              />
            </>
          ) : (
            <Path
              d={cutFramePath(size.width, size.height, cut, borderWidth)}
              fill={fill}
              stroke={stroke}
              strokeWidth={borderWidth}
            />
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { position: 'absolute', left: 0, right: 0, height: 1 },
});
