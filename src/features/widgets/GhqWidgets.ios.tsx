import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetSnapshot } from './snapshot';

// The widgets on iPhone (design-sezioni.md 12.1–12.4, 12.10), drawn with SwiftUI by expo-widgets.
// Each layout is a 'widget' function: it is turned into a string and run by the widget without
// the app, so it uses only its props, the components of @expo/ui and nothing else of this file.
// The touch on a circle completes in the widget at once and keeps the target in `pending`; the
// app reads it with `getTimeline` when it starts or comes back (`system.ts`).

const SmallLayout = (props: WidgetSnapshot, environment: WidgetEnvironment) => {
  'widget';
  const colors = environment.colorScheme === 'dark' ? props.colors.dark : props.colors.light;
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        containerBackground(colors.background, 'widget'),
        widgetURL(props.urls.open),
        accessibilityLabel(props.description),
      ]}
    >
      <HStack spacing={4}>
        <Image systemName="flame.fill" color={colors.danger} size={18} />
        <Text
          modifiers={[
            font({ size: 30, weight: 'bold' }),
            monospacedDigit(),
            foregroundStyle(colors.text),
          ]}
        >
          {String(props.streak)}
        </Text>
        <Spacer />
      </HStack>
      {props.levelText !== null ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.textMuted)]}>
          {props.levelText}
        </Text>
      ) : null}
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(colors.text)]}>
        {props.state === 'rest' ? (props.message ?? '') : props.remainingTexts[props.remaining]}
      </Text>
      <Spacer />
      <HStack>
        <Spacer />
        {props.unseen > 0 ? (
          <Text
            modifiers={[
              font({ size: 13, weight: 'bold' }),
              foregroundStyle(colors.onPrimary),
              padding({ horizontal: 7, vertical: 3 }),
              background(colors.danger),
              clipShape('capsule'),
              accessibilityLabel(props.unseenText ?? ''),
            ]}
          >
            {String(props.unseen)}
          </Text>
        ) : null}
      </HStack>
    </VStack>
  );
};

const MediumLayout = (props: WidgetSnapshot, environment: WidgetEnvironment) => {
  'widget';
  const colors = environment.colorScheme === 'dark' ? props.colors.dark : props.colors.light;

  // The touch on a circle, before the app knows: the row is done (or moves by its increment),
  // goes to the bottom like in Today, and its target waits in pending.
  const press = (id: string) => () => {
    let done = props.done;
    const missions = props.missions.map((item) => {
      if (item.id !== id || item.done || item.target === null) {
        return item;
      }
      const value = item.measurable ? item.value + (item.step ?? 0) : item.value;
      const finished = !item.measurable || (item.goal !== null && value >= item.goal);
      if (finished) {
        done += 1;
      }
      return {
        ...item,
        value,
        done: finished,
        xp: finished ? null : item.xp,
        // The stamp of `progressStamp`: the generation of the snapshot and the value reached.
        target: finished
          ? null
          : ['p', item.id, props.day, props.generation + '~' + String(value)].join('|'),
      };
    });
    const target = props.missions.find((item) => item.id === id)?.target;
    return {
      missions: [...missions.filter((item) => !item.done), ...missions.filter((item) => item.done)],
      done,
      remaining: Math.max(0, props.total - done),
      state: done >= props.total ? 'full_day' : props.state,
      message: done >= props.total ? props.fullDayText : props.message,
      pending: target ? [...props.pending, target] : props.pending,
    };
  };

  const header = (
    <HStack spacing={6}>
      <Image systemName="flame.fill" color={colors.danger} size={14} />
      <Text
        modifiers={[
          font({ size: 17, weight: 'bold' }),
          monospacedDigit(),
          foregroundStyle(colors.text),
        ]}
      >
        {String(props.streak)}
      </Text>
      <Spacer />
      {props.levelText !== null ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.textMuted)]}>
          {props.levelText}
        </Text>
      ) : null}
      <Spacer />
      <Text
        modifiers={[
          font({ size: 17, weight: 'bold' }),
          monospacedDigit(),
          foregroundStyle(colors.text),
        ]}
      >
        {props.progressTexts[props.done] ?? props.progressText}
      </Text>
    </HStack>
  );

  if (props.state !== 'missions') {
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          containerBackground(colors.background, 'widget'),
          widgetURL(props.urls.open),
          accessibilityLabel(props.description),
        ]}
      >
        {header}
        <Spacer />
        <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(colors.text)]}>
          {props.message ?? ''}
        </Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        containerBackground(colors.background, 'widget'),
        widgetURL(props.urls.open),
        accessibilityLabel(props.description),
      ]}
    >
      {header}
      {props.missions.map((item) => (
        <HStack key={item.id} spacing={8}>
          <Button
            target={item.target ?? `done|${item.id}`}
            onPress={press(item.id)}
            modifiers={[buttonStyle('plain'), accessibilityLabel(item.a11y)]}
          >
            <Image
              systemName={item.done ? 'checkmark.circle.fill' : 'circle'}
              color={item.done ? colors.done : colors.textMuted}
              size={20}
            />
          </Button>
          <Link destination={item.url} modifiers={[accessibilityLabel(item.openA11y)]}>
            <Text
              modifiers={[
                font({ size: 15 }),
                lineLimit(1),
                foregroundStyle(item.done ? colors.textMuted : colors.text),
              ]}
            >
              {item.name}
            </Text>
          </Link>
          <Spacer />
          {item.detail !== null || item.xp !== null ? (
            <Text
              modifiers={[font({ size: 13 }), monospacedDigit(), foregroundStyle(colors.textMuted)]}
            >
              {item.detail ?? item.xp ?? ''}
            </Text>
          ) : null}
        </HStack>
      ))}
      {props.moreText !== null ? (
        <Link destination={props.urls.more} modifiers={[accessibilityLabel(props.moreA11y)]}>
          <Text
            modifiers={[
              font({ size: 13 }),
              foregroundStyle(colors.textMuted),
              padding({ leading: 28 }),
              frame({ height: 18 }),
            ]}
          >
            {props.moreText}
          </Text>
        </Link>
      ) : null}
      <Spacer />
    </VStack>
  );
};

export const smallWidget = createWidget<WidgetSnapshot>('GhqSmall', SmallLayout);
export const mediumWidget = createWidget<WidgetSnapshot>('GhqMedium', MediumLayout);
