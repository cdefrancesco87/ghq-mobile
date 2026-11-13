import { Button, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  font,
  foregroundStyle,
  lineLimit,
  monospacedDigit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { TimerActivityProps } from './timerActivity';

// The Live Activity of the timer on iPhone (design-sezioni.md 12.5; backlog T87), drawn with
// SwiftUI by expo-widgets on the Lock Screen and in the Dynamic Island. Like the widgets, the
// layout is a 'widget' function run without the app: it uses only its props and @expo/ui. The
// countdown and the bar move by themselves (SwiftUI timers): the app updates the activity only at
// the play, the pause and the end. Past the end with the app asleep the activity is stale and
// says «Tempo finito»: the mission is completed at the next opening of Today (T79).

const TimerLayout = (props: TimerActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const colors = environment.colorScheme === 'dark' ? props.colors.dark : props.colors.light;
  const range = { lower: new Date(props.startsAt), upper: new Date(props.endsAt) };
  const running = props.phase === 'running' && environment.isStale !== true;
  const label =
    props.phase === 'done'
      ? props.texts.done
      : props.phase === 'paused'
        ? `${props.texts.paused} · ${props.remainingText}`
        : props.texts.timeUp;

  const time = (size: number) =>
    running ? (
      <Text
        timerInterval={range}
        countsDown
        modifiers={[
          font({ size, weight: 'semibold' }),
          monospacedDigit(),
          foregroundStyle(colors.text),
        ]}
      />
    ) : (
      <Text
        modifiers={[
          font({ size, weight: 'semibold' }),
          monospacedDigit(),
          lineLimit(1),
          foregroundStyle(props.phase === 'done' ? colors.done : colors.text),
        ]}
      >
        {size > 16 ? label : props.phase === 'paused' ? props.remainingText : label}
      </Text>
    );

  const bar = running ? (
    <ProgressView timerInterval={range} countsDown={false} modifiers={[tint(colors.primary)]} />
  ) : (
    <ProgressView value={props.progress} modifiers={[tint(colors.primary)]} />
  );

  const buttons =
    props.phase === 'done' ? null : (
      <HStack spacing={12}>
        {props.phase === 'paused' ? (
          <Button
            target={props.targets.resume}
            label={props.texts.resume}
            systemImage="play.fill"
            modifiers={[
              buttonStyle('bordered'),
              tint(colors.primary),
              accessibilityLabel(props.texts.resumeA11y),
            ]}
          />
        ) : (
          <Button
            target={props.targets.pause}
            label={props.texts.pause}
            systemImage="pause.fill"
            modifiers={[
              buttonStyle('bordered'),
              tint(colors.primary),
              accessibilityLabel(props.texts.pauseA11y),
            ]}
          />
        )}
        <Button
          target={props.targets.complete}
          label={props.texts.complete}
          systemImage="checkmark"
          modifiers={[
            buttonStyle('borderedProminent'),
            tint(colors.primary),
            accessibilityLabel(props.texts.completeA11y),
          ]}
        />
      </HStack>
    );

  const icon = (
    <Image
      systemName={props.phase === 'done' ? 'checkmark.circle.fill' : 'timer'}
      color={props.phase === 'done' ? colors.done : colors.primary}
      size={16}
    />
  );

  const name = (
    <Text
      modifiers={[
        font({ size: 15, weight: 'semibold' }),
        lineLimit(1),
        foregroundStyle(colors.text),
      ]}
    >
      {props.name}
    </Text>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={6}>
          {icon}
          {name}
          <Spacer />
          {time(22)}
        </HStack>
        {bar}
        {buttons}
      </VStack>
    ),
    compactLeading: icon,
    compactTrailing: time(14),
    minimal: icon,
    expandedLeading: (
      <HStack spacing={6}>
        {icon}
        {name}
      </HStack>
    ),
    expandedTrailing: time(20),
    expandedBottom: (
      <VStack spacing={8}>
        {bar}
        {buttons}
      </VStack>
    ),
  };
};

export const timerActivity = createLiveActivity<TimerActivityProps>('GhqTimer', TimerLayout);
