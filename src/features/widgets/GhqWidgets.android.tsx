import { Box, Button, Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetSnapshot } from './snapshot';

// The widgets on Android (design-sezioni.md 12.1–12.4), drawn with Jetpack Glance by expo-widgets.
// Each layout is a 'widget' function: it is turned into a string and run by the widget without
// the app, so it uses only its props, the components of @expo/ui and nothing else of this file.
// The touch on a circle completes in the widget at once and reaches the app as an event while the
// app is running (`system.ts`). Glance here has no links: the names do not open the app.

const SmallLayout = (props: WidgetSnapshot, environment: WidgetEnvironment) => {
  'widget';
  const colors = environment.colorScheme === 'dark' ? props.colors.dark : props.colors.light;
  return (
    <Column modifiers={[fillMaxSize(), background(colors.background), paddingAll(14)]}>
      <Row>
        <Text style={{ fontSize: 22 }}>🔥</Text>
        <Spacer modifiers={[width(6)]} />
        <Text color={colors.text} style={{ fontSize: 28, fontWeight: 'bold' }}>
          {String(props.streak)}
        </Text>
      </Row>
      {props.levelText !== null ? (
        <Text color={colors.textMuted} style={{ fontSize: 13 }}>
          {props.levelText}
        </Text>
      ) : null}
      <Spacer modifiers={[height(6)]} />
      <Text color={colors.text} style={{ fontSize: 16, fontWeight: 'bold' }} maxLines={2}>
        {props.state === 'rest' ? (props.message ?? '') : props.remainingTexts[props.remaining]}
      </Text>
      <Spacer modifiers={[height(8)]} />
      {props.unseen > 0 ? (
        <Row modifiers={[fillMaxWidth()]}>
          <Spacer modifiers={[width(96)]} />
          <Box modifiers={[background(colors.danger), cornerRadius(12), padding(8, 2, 8, 2)]}>
            <Text color={colors.onPrimary} style={{ fontSize: 13, fontWeight: 'bold' }}>
              {String(props.unseen)}
            </Text>
          </Box>
        </Row>
      ) : null}
    </Column>
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
        target: finished ? null : ['p', item.id, props.day, String(value)].join('|'),
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
    <Row modifiers={[fillMaxWidth()]}>
      <Text style={{ fontSize: 15 }}>🔥</Text>
      <Spacer modifiers={[width(6)]} />
      <Text color={colors.text} style={{ fontSize: 17, fontWeight: 'bold' }}>
        {String(props.streak)}
      </Text>
      <Spacer modifiers={[width(16)]} />
      {props.levelText !== null ? (
        <Text color={colors.textMuted} style={{ fontSize: 13 }}>
          {props.levelText}
        </Text>
      ) : null}
      <Spacer modifiers={[width(16)]} />
      <Text color={colors.text} style={{ fontSize: 17, fontWeight: 'bold' }}>
        {props.progressTexts[props.done] ?? props.progressText}
      </Text>
    </Row>
  );

  return (
    <Column modifiers={[fillMaxSize(), background(colors.background), paddingAll(14)]}>
      {header}
      <Spacer modifiers={[height(8)]} />
      {props.state !== 'missions' ? (
        <Text color={colors.text} style={{ fontSize: 16, fontWeight: 'bold' }}>
          {props.message ?? ''}
        </Text>
      ) : null}
      {props.state === 'missions'
        ? props.missions.map((item) => (
            <Row key={item.id} modifiers={[fillMaxWidth(), padding(0, 2, 0, 2)]}>
              <Button
                {...{ target: item.target ?? `done|${item.id}` }}
                enabled={!item.done}
                onClick={press(item.id)}
                colors={{ containerColor: colors.background }}
              >
                <Box
                  modifiers={[
                    size(20, 20),
                    cornerRadius(10),
                    background(item.done ? colors.done : colors.border),
                  ]}
                >
                  <Spacer modifiers={[size(1, 1)]} />
                </Box>
              </Button>
              <Spacer modifiers={[width(10)]} />
              <Text
                color={item.done ? colors.textMuted : colors.text}
                style={{ fontSize: 15 }}
                maxLines={1}
              >
                {item.name}
              </Text>
              <Spacer modifiers={[width(8)]} />
              <Text color={colors.textMuted} style={{ fontSize: 13 }} maxLines={1}>
                {item.detail ?? item.xp ?? ''}
              </Text>
            </Row>
          ))
        : null}
      {props.state === 'missions' && props.moreText !== null ? (
        <Text color={colors.textMuted} style={{ fontSize: 13 }} modifiers={[padding(30, 2, 0, 0)]}>
          {props.moreText}
        </Text>
      ) : null}
    </Column>
  );
};

export const smallWidget = createWidget<WidgetSnapshot>('GhqSmall', SmallLayout);
export const mediumWidget = createWidget<WidgetSnapshot>('GhqMedium', MediumLayout);
