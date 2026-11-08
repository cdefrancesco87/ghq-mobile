import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { SettingValue } from '@/db/repositories/settings';
import { ActionSheet } from '@/features/shared/ActionSheet';
import { Bar } from '@/features/shared/Bar';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Chip } from '@/features/shared/Chip';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { Difficulty } from '@/features/shared/Difficulty';
import { EmptyState } from '@/features/shared/EmptyState';
import { ScreenHeader, useHeaderScroll } from '@/features/shared/ScreenHeader';
import { SegmentedControl } from '@/features/shared/SegmentedControl';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { useUndoToast } from '@/features/shared/UndoToast';
import { useLargeText } from '@/features/shared/useLargeText';
import { useThemeStore } from '@/stores/theme';
import { useTheme } from '@/theme/ThemeProvider';

// TEMPORARY test screen of T34, only on the branch chore/t34-device-test: it must not be merged.
// It exists only in development builds. Fixed texts without i18n keys are accepted only here. The
// theme is the real setting, so that the undo notice above the screens changes with it.

type Overlay = 'titled' | 'untitled' | 'full' | 'actions' | 'confirm';

const THEME_CHOICES: readonly { value: SettingValue<'theme'>; label: string }[] = [
  { value: 'minimal-chiaro', label: 'Minimal chiaro' },
  { value: 'minimal-scuro', label: 'Minimal scuro' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'lovecraft', label: 'Lovecraft' },
];

const TWO_SEGMENTS = [
  { value: 'one', label: 'Oggi' },
  { value: 'two', label: 'Settimana' },
] as const;

const THREE_SEGMENTS = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Media' },
  { value: 'hard', label: 'Difficile' },
] as const;

const LONG_LIST = Array.from({ length: 40 }, (_, index) => `Riga ${index + 1}`);

export default function ComponentsTest() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <ComponentsTestScreen />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="sectionTitle" accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function ComponentsTestScreen() {
  const { colors } = useTheme();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const { fontScale } = useWindowDimensions();
  const largeText = useLargeText();
  const undoToast = useUndoToast();
  const { scrollY, onScroll } = useHeaderScroll();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [status, setStatus] = useState('Nessuna azione.');
  const [two, setTwo] = useState<(typeof TWO_SEGMENTS)[number]['value']>('one');
  const [three, setThree] = useState<(typeof THREE_SEGMENTS)[number]['value']>('medium');
  const [chip, setChip] = useState(true);

  const close = () => setOverlay(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Prova componenti"
        caption={`Impostazione tema: ${theme}`}
        onBack={() => setStatus('Premuta la freccia di ScreenHeader.')}
        scrollY={scrollY}
      />
      <Animated.ScrollView onScroll={onScroll} contentContainerStyle={styles.content}>
        <ThemedText color={colors.textMuted}>
          {`fontScale ${fontScale.toFixed(2)} · testo molto grande: ${largeText ? 'sì' : 'no'}`}
        </ThemedText>
        <ThemedText>{`Ultima azione: ${status}`}</ThemedText>

        <Section title="Tema">
          <View style={styles.wrap}>
            {THEME_CHOICES.map((choice) => (
              <Chip
                key={choice.value}
                label={choice.label}
                selected={choice.value === theme}
                onPress={() => setTheme(choice.value)}
                testID={`theme-${choice.value}`}
              />
            ))}
          </View>
        </Section>

        <Section title="Fogli e dialogo">
          <Button
            label="Sheet con titolo"
            onPress={() => setOverlay('titled')}
            testID="open-titled"
          />
          <Button
            label="Sheet senza titolo"
            onPress={() => setOverlay('untitled')}
            testID="open-untitled"
          />
          <Button
            label="Sheet a tutta altezza"
            onPress={() => setOverlay('full')}
            testID="open-full"
          />
          <Button label="ActionSheet" onPress={() => setOverlay('actions')} testID="open-actions" />
          <Button
            label="ConfirmDialog"
            onPress={() => setOverlay('confirm')}
            testID="open-confirm"
          />
        </Section>

        <Section title="UndoToast">
          <Button
            label="Mostra UndoToast"
            onPress={() => {
              setStatus('UndoToast mostrato.');
              undoToast.show({
                message: 'Missione completata',
                onUndo: () => setStatus('Premuto Annulla su UndoToast.'),
              });
            }}
            testID="show-toast"
          />
        </Section>

        <Section title="SegmentedControl">
          <SegmentedControl
            options={TWO_SEGMENTS}
            value={two}
            onChange={setTwo}
            testID="segments-two"
            accessibilityLabel="Prova con due segmenti"
          />
          <SegmentedControl
            options={THREE_SEGMENTS}
            value={three}
            onChange={setThree}
            testID="segments-three"
            accessibilityLabel="Prova con tre segmenti"
          />
        </Section>

        <Section title="Button">
          <Button label="Primario" onPress={() => setStatus('Primario.')} testID="button-primary" />
          <Button
            variant="secondary"
            label="Secondario"
            onPress={() => setStatus('Secondario.')}
            testID="button-secondary"
          />
          <Button
            variant="text"
            label="Solo testo"
            onPress={() => setStatus('Solo testo.')}
            testID="button-text"
          />
          <Button
            variant="destructive"
            label="Distruttivo"
            onPress={() => setStatus('Distruttivo.')}
            testID="button-destructive"
          />
          <Button
            disabled
            disabledReason="Prova di pulsante disabilitato"
            label="Disabilitato"
            onPress={() => setStatus('Disabilitato: non deve succedere.')}
            testID="button-disabled"
          />
        </Section>

        <Section title="Chip">
          <View style={styles.wrap}>
            <Chip label="Scelto" selected={chip} onPress={() => setChip(true)} testID="chip-on" />
            <Chip
              label="Non scelto"
              selected={!chip}
              onPress={() => setChip(false)}
              testID="chip-off"
            />
          </View>
        </Section>

        <Section title="Bar">
          <Bar kind="hp" label="Vita" value={65} max={100} testID="bar-hp" />
          <Bar kind="xp" label="Esperienza" value={120} max={200} testID="bar-xp" />
          <Bar kind="boss" label="Boss" value={40} max={100} testID="bar-boss" />
          <Bar kind="stat" label="Statistica" value={8} max={20} testID="bar-stat" />
          <Bar kind="hp" label="Vuota" value={0} max={100} testID="bar-empty" />
          <Bar kind="xp" label="Piena" value={200} max={200} testID="bar-full" />
        </Section>

        <Section title="Difficulty">
          <Difficulty difficulty="easy" />
          <Difficulty difficulty="medium" />
          <Difficulty difficulty="hard" />
          <Difficulty difficulty="hard" showWord={false} />
        </Section>

        <Section title="Card">
          <Card>
            <ThemedText>Card normale</ThemedText>
          </Card>
          <Card surface="high">
            <ThemedText>Card con superficie alta</ThemedText>
          </Card>
        </Section>

        <Section title="EmptyState">
          <EmptyState
            message="Non c'è ancora nessuna missione: creane una per iniziare."
            actionLabel="Crea missione"
            onAction={() => setStatus('Azione di EmptyState.')}
            testID="empty-state"
          />
        </Section>

        <Section title="ThemedText">
          <ThemedText variant="display">Display</ThemedText>
          <ThemedText variant="screenTitle">Titolo schermata</ThemedText>
          <ThemedText variant="sectionTitle">Titolo sezione</ThemedText>
          <ThemedText>Testo normale, abbastanza lungo da andare a capo su un telefono.</ThemedText>
          <ThemedText variant="label">Etichetta</ThemedText>
          <ThemedText variant="numbers">1234567890</ThemedText>
          <ThemedText variant="caption">Didascalia</ThemedText>
        </Section>
      </Animated.ScrollView>

      <Sheet visible={overlay === 'titled'} onClose={close} title="Foglio con titolo">
        <ThemedText>Trascina dalla maniglia o dal titolo, oppure tocca il velo.</ThemedText>
      </Sheet>
      <Sheet visible={overlay === 'untitled'} onClose={close} testID="sheet-untitled">
        <ThemedText>Questo foglio non ha un titolo: si trascina dalla maniglia.</ThemedText>
      </Sheet>
      <Sheet
        visible={overlay === 'full'}
        onClose={close}
        size="full"
        title="Foglio a tutta altezza"
        testID="sheet-full"
      >
        {LONG_LIST.map((line) => (
          <ThemedText key={line} style={styles.line}>
            {line}
          </ThemedText>
        ))}
      </Sheet>
      <ActionSheet
        visible={overlay === 'actions'}
        onClose={close}
        title="Menu di prova"
        items={[
          { key: 'edit', label: 'Modifica', onPress: () => setStatus('Menu: Modifica.') },
          {
            key: 'disabled',
            label: 'Non disponibile',
            disabled: true,
            onPress: () => setStatus('Menu: disabilitato, non deve succedere.'),
          },
          {
            key: 'delete',
            label: 'Elimina',
            destructive: true,
            onPress: () => setStatus('Menu: Elimina.'),
          },
        ]}
      />
      <ConfirmDialog
        visible={overlay === 'confirm'}
        title="Eliminare la missione?"
        message="Questa azione non si può annullare."
        confirmLabel="Elimina"
        onConfirm={() => {
          close();
          setStatus('Dialogo: confermato.');
        }}
        onCancel={() => {
          close();
          setStatus('Dialogo: annullato.');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 160, gap: 24 },
  section: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  line: { paddingVertical: 8 },
});
