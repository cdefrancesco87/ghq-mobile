import { router } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { EventRow } from '@/db/repositories/events';
import { useTheme } from '@/theme/ThemeProvider';
import { HatchMoment } from './HatchMoment';
import { MomentScreen } from './MomentScreen';
import { addMoments, momentsFromEvents, waitsForTouch, type Moment } from './moments';
import { useReduceMotion } from './useReduceMotion';

/** A moment lasts at most 2.5 seconds (design-sezioni.md A7); a victory waits for its buttons. */
export const MOMENT_MAX_MS = 2500;

/** The storyboard C2a: the action ends on the screen, then at 300 ms the screen dims in 200 ms. */
const DIM_DELAY_MS = 300;
const DIM_MS = 200;
const REDUCED_FADE_MS = 150;

interface MomentQueueApi {
  /** Queues the moments among the events returned by an action of the repositories. */
  readonly enqueue: (events: readonly EventRow[]) => void;
  /**
   * Keeps the moments of the events until `showWaiting`: the victory of the quest of the first
   * launch, won by opening the statistics, shows when the hero is back on Today (design 1.8).
   */
  readonly enqueueLater: (events: readonly EventRow[]) => void;
  /** Shows the moments kept by `enqueueLater`. */
  readonly showWaiting: () => void;
}

const MomentQueueContext = createContext<MomentQueueApi | null>(null);

/** Gives `useMomentQueue` to the screens and shows the moments above them, one at a time. */
export function MomentQueueProvider({ children }: { readonly children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [queue, setQueue] = useState<readonly Moment[]>([]);
  // Not state: nothing on screen changes until they are shown.
  const later = useRef<Moment[]>([]);
  const current = queue[0];
  const currentId = current !== undefined && !waitsForTouch(current) ? current.id : undefined;

  const api = useMemo<MomentQueueApi>(
    () => ({
      enqueue: (events) => {
        const moments = momentsFromEvents(events);
        if (moments.length > 0) {
          setQueue((waiting) => addMoments(waiting, moments));
        }
      },
      enqueueLater: (events) => {
        later.current.push(...momentsFromEvents(events));
      },
      showWaiting: () => {
        const waiting = later.current;
        if (waiting.length > 0) {
          later.current = [];
          setQueue((shown) => addMoments(shown, waiting));
        }
      },
    }),
    [],
  );

  const next = () => setQueue((waiting) => waiting.slice(1));

  // Until the Hall of trophies (T65), the trophy is the card of the defeated boss.
  const seeTrophy = (bossId: string) => {
    next();
    router.navigate({ pathname: '/boss/[id]', params: { id: bossId } });
  };

  useEffect(() => {
    if (currentId === undefined) {
      return undefined;
    }
    const timer = setTimeout(() => setQueue((waiting) => waiting.slice(1)), MOMENT_MAX_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  return (
    <MomentQueueContext value={api}>
      {children}
      {current === undefined ? null : (
        <Modal
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="none"
          onRequestClose={next}
        >
          <MomentBackground reduceMotion={reduceMotion}>
            {current.kind === 'hatch' ? (
              <HatchMoment key={current.id} reduceMotion={reduceMotion} onDone={next} />
            ) : (
              <MomentScreen
                key={current.id}
                moment={current}
                reduceMotion={reduceMotion}
                onSkip={next}
                onSeeTrophy={seeTrophy}
              />
            )}
          </MomentBackground>
        </Modal>
      )}
    </MomentQueueContext>
  );
}

/** Queues the moments of an action: level up, victory over a boss, companion stage, badge. */
export function useMomentQueue(): MomentQueueApi {
  const api = useContext(MomentQueueContext);
  if (api === null) {
    throw new Error('useMomentQueue must be used inside a MomentQueueProvider');
  }
  return api;
}

function MomentBackground({
  reduceMotion,
  children,
}: {
  readonly reduceMotion: boolean;
  readonly children: ReactNode;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.set(
      reduceMotion
        ? withTiming(1, { duration: REDUCED_FADE_MS })
        : withDelay(DIM_DELAY_MS, withTiming(1, { duration: DIM_MS })),
    );
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
