import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { BUTTON_HEIGHT } from './Button';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';

/** How long the notice stays on screen (design-sezioni.md A6). */
export const UNDO_TOAST_MS = 5000;

/** The notice stays above the navigation bar (misure-componenti.md: 64 high, 16 from the edges). */
const NAV_BAR_HEIGHT = 64;
const EDGE = 16;

export interface UndoToastRequest {
  readonly message: string;
  /** Without it the notice only informs: it has no «Annulla». */
  readonly onUndo?: () => void;
}

interface UndoToastApi {
  /** Shows the notice for 5 seconds, in place of the one on screen: one at a time. */
  readonly show: (request: UndoToastRequest) => void;
}

const UndoToastContext = createContext<UndoToastApi | null>(null);

/** Gives `useUndoToast` to the screens and draws the notice above them. */
export function UndoToastProvider({ children }: { readonly children: ReactNode }) {
  const [request, setRequest] = useState<UndoToastRequest | null>(null);
  const api = useMemo<UndoToastApi>(() => ({ show: (next) => setRequest({ ...next }) }), []);

  useEffect(() => {
    if (request === null) {
      return undefined;
    }
    const timer = setTimeout(() => setRequest(null), UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [request]);

  const onUndo = request?.onUndo;

  return (
    <UndoToastContext value={api}>
      <View style={styles.root}>
        {children}
        {request === null ? null : (
          <UndoToast
            message={request.message}
            onUndo={
              onUndo === undefined
                ? undefined
                : () => {
                    setRequest(null);
                    onUndo();
                  }
            }
          />
        )}
      </View>
    </UndoToastContext>
  );
}

/** Shows the notice with «Annulla» after completions, archiving and skips, or a short message. */
export function useUndoToast(): UndoToastApi {
  const api = useContext(UndoToastContext);
  if (api === null) {
    throw new Error('useUndoToast must be used inside an UndoToastProvider');
  }
  return api;
}

/** The notice when there is one: the providers that sit above it in some trees use this. */
export function useOptionalUndoToast(): UndoToastApi | null {
  return useContext(UndoToastContext);
}

function UndoToast({ message, onUndo }: UndoToastRequest) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      testID="undo-toast"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom: bottom + NAV_BAR_HEIGHT + EDGE }]}
    >
      <Frame shape={shape.control} fill={colors.text} stroke={colors.text} />
      <ThemedText
        color={colors.background}
        style={[styles.message, onUndo === undefined ? styles.messageAlone : null]}
      >
        {message}
      </ThemedText>
      {onUndo === undefined ? null : (
        <Pressable
          testID="undo-toast-undo"
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel={t('shared.undo')}
          style={styles.undo}
        >
          <ThemedText variant="label" color={colors.background}>
            {t('shared.undo')}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toast: {
    position: 'absolute',
    left: EDGE,
    right: EDGE,
    minHeight: BUTTON_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  message: { flex: 1, paddingVertical: 8 },
  messageAlone: { paddingRight: 16 },
  undo: { minHeight: BUTTON_HEIGHT, paddingHorizontal: 16, justifyContent: 'center' },
});
