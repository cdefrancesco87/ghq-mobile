import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TITLE_KEYS } from '@/content/titles';
import { renameHero, type ProfileView } from '@/db/repositories/profile';
import { Bar } from '@/features/shared/Bar';
import { Card } from '@/features/shared/Card';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useLargeText } from '@/features/shared/useLargeText';
import { useUndoToast } from '@/features/shared/UndoToast';
import { termInSentence } from '@/i18n/lexicon';
import { companionName } from '@/rules/companion';
import { PROFILE } from '@/rules/config';
import { titleIndex } from '@/rules/level';
import type { StatKey } from '@/rules/types';
import { runAction } from '@/stores/app';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';
import { Emblem } from './Emblem';
import { StatSheet } from './StatSheet';
import { StatTile } from './StatTile';
import { useStatDetail } from './useProfileView';

/** The order of the tiles in the mockup B7, two per row. */
export const SHEET_ORDER: readonly StatKey[] = [
  'strength',
  'intelligence',
  'constitution',
  'charisma',
  'wisdom',
  'discipline',
];

const FIELD_HEIGHT = 48;
const ROW_HEIGHT = 56;
/** The pixel sprites scale by whole multiples of their 32 grid (design-sezioni.md A5). */
const COMPANION_ICON = 32;

export interface ProfileScreenProps {
  readonly view: ProfileView;
}

/**
 * Profilo (analisi-funzionale.md section 9; design-sezioni.md 9.1–9.5, 9.7, 9.11; mockups B7,
 * D33): the title of the theme with the gear of the Settings; the emblem with the initial, the
 * name with a pencil (up to 24 characters, Invio confirms), title, level and experience; streak,
 * missions completed and bosses defeated; the character sheet, 2×3 or one column with very large
 * text, whose tiles open the detail of the stat; the links to Statistics, companion, shop, Hall of
 * trophies (a placeholder until T65) and Settings. Badges (T70) and the form arrow (T69) come later.
 */
export function ProfileScreen({ view }: ProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const { colors, family, typography } = useTheme();
  const router = useRouter();
  const toast = useUndoToast();
  const largeText = useLargeText();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [stat, setStat] = useState<StatKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const detail = useStatDetail(stat);
  const { hero, companion, stats } = view;

  const term = (key: string) => t(`lexicon.${key}`, { context: family });
  const inSentence = (key: string) => termInSentence(term(key), i18n.language);
  const companionLabel = companionName(companion.name, term('companion'));
  const hallLabel = term('trophyHall');

  const startEditing = () => {
    setDraft(hero.name);
    setEditing(true);
  };
  const save = () => {
    if (!editing) {
      return;
    }
    setEditing(false);
    // An empty name keeps the one before: the hero always has a name.
    if (draft.trim() !== '') {
      runAction((db, clock) => renameHero(db, draft, clock));
    }
  };
  const openStat = (key: StatKey) => {
    setStat(key);
    setSheetOpen(true);
  };

  const numbers = [
    { key: 'streak', value: hero.streak, label: term('streak') },
    { key: 'missions', value: view.completionsTotal, label: term('missions_pl') },
    {
      key: 'bosses',
      value: view.bossesDefeated,
      label: t('profile.bossesDefeated', { context: family }),
    },
  ];
  const rows = SHEET_ORDER.map((key) => stats.find((row) => row.stat === key)).filter(
    (row) => row !== undefined,
  );

  return (
    <View testID="profile-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="profile-header"
        title={term('screenProfile')}
        caption={hero.name}
        actions={
          <Pressable
            testID="profile-settings"
            accessibilityRole="button"
            accessibilityLabel={t('profile.settings')}
            onPress={() => router.push('/settings')}
            style={styles.gear}
          >
            <Icon name="impostazioni" color={colors.text} />
          </Pressable>
        }
      />
      <ScrollView
        testID="profile-scroll"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Card testID="profile-hero">
          <View style={[styles.identity, largeText ? styles.identityStacked : null]}>
            <Emblem name={hero.name} />
            <View style={styles.flex}>
              {editing ? (
                <View style={styles.form}>
                  <View style={styles.field}>
                    <Frame
                      shape={SHAPES[family].control}
                      fill={colors.surface}
                      stroke={colors.textMuted}
                    />
                    <TextInput
                      testID="profile-name-input"
                      value={draft}
                      onChangeText={(text) => setDraft(text.slice(0, PROFILE.nameMaxLength))}
                      onSubmitEditing={save}
                      onBlur={save}
                      selectionColor={colors.primary}
                      maxLength={PROFILE.nameMaxLength}
                      maxFontSizeMultiplier={MAX_TEXT_SCALE}
                      autoFocus
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      accessibilityLabel={t('profile.nameLabel')}
                      style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
                    />
                  </View>
                  <ThemedText variant="caption" color={colors.textMuted}>
                    {t('profile.nameHint', { max: PROFILE.nameMaxLength })}
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <ThemedText
                    testID="profile-name"
                    variant="sectionTitle"
                    accessibilityRole="header"
                    style={styles.shrink}
                  >
                    {hero.name}
                  </ThemedText>
                  <Pressable
                    testID="profile-rename"
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.rename')}
                    onPress={startEditing}
                    style={styles.pencil}
                  >
                    <Icon name="modifica" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}
              <ThemedText testID="profile-title" variant="caption" color={colors.textMuted}>
                {t(`titles.${family}.${TITLE_KEYS[family][titleIndex(hero.level)]}`)}
              </ThemedText>
              <ThemedText testID="profile-level" variant="screenTitle">
                {t('today.hero.level', { term: term('level'), level: hero.level })}
              </ThemedText>
              {view.xpToNext === null ? null : (
                <Bar
                  kind="xp"
                  label={term('xp')}
                  value={hero.xpInLevel}
                  max={view.xpToNext}
                  showLabel={false}
                  showValue={false}
                  testID="profile-xp"
                />
              )}
              <ThemedText testID="profile-to-next" variant="caption" color={colors.textMuted}>
                {view.xpToNext === null
                  ? t('profile.maxLevel')
                  : t('profile.toNext', {
                      xp: hero.xpInLevel,
                      max: view.xpToNext,
                      xpTerm: inSentence('xp'),
                      levelTerm: inSentence('level'),
                      next: hero.level + 1,
                    })}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.numbers}>
            {numbers.map((item) => (
              <View
                key={item.key}
                testID={`profile-number-${item.key}`}
                accessible
                accessibilityLabel={t('profile.numbersLabel', {
                  label: item.label,
                  value: item.value,
                })}
                style={styles.number}
              >
                <ThemedText testID={`profile-number-${item.key}-value`} variant="numbers">
                  {String(item.value)}
                </ThemedText>
                <ThemedText variant="caption" color={colors.textMuted} style={styles.center}>
                  {item.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <ThemedText variant="caption" color={colors.textMuted} accessibilityRole="header">
          {t('profile.sheet')}
        </ThemedText>
        <View testID="profile-sheet" style={styles.grid}>
          {rows.map((row) => (
            <StatTile
              key={row.stat}
              row={row}
              fullWidth={largeText}
              onPress={() => openStat(row.stat)}
            />
          ))}
        </View>

        <ThemedText variant="caption" color={colors.textMuted} accessibilityRole="header">
          {t('profile.more')}
        </ThemedText>
        <Card testID="profile-links" style={styles.links}>
          <LinkRow
            testID="profile-link-stats"
            icon={<Icon name="statistiche" size={20} color={colors.text} />}
            label={term('screenStats')}
            onPress={() => router.push('/stats')}
          />
          <LinkRow
            testID="profile-link-companion"
            icon={
              <CompanionSprite
                stage={companion.stage}
                mood={companion.mood}
                name={companionLabel}
                size={COMPANION_ICON}
              />
            }
            label={companionLabel}
            value={
              companion.stage === 'egg'
                ? t('shared.companionSprite.stage.egg')
                : t(`shared.companionSprite.mood.${companion.mood}`)
            }
            onPress={() => router.push('/companion')}
          />
          <LinkRow
            testID="profile-link-shop"
            icon={<Icon name="negozio" size={20} color={colors.text} />}
            label={t('profile.links.shop', {
              shop: t('shop.title', { context: family }),
              inventory: termInSentence(t('shop.inventory', { context: family }), i18n.language),
            })}
            value={String(hero.coins)}
            valueLabel={`${hero.coins} ${inSentence(hero.coins === 1 ? 'coins' : 'coins_pl')}`}
            onPress={() => router.push('/shop')}
          />
          <LinkRow
            testID="profile-link-trophies"
            icon={<Icon name="trofeo" size={20} color={colors.text} />}
            label={hallLabel}
            value={String(view.bossesDefeated)}
            onPress={() =>
              toast.show({ message: t('profile.links.trophiesSoon', { hall: hallLabel }) })
            }
          />
          <LinkRow
            testID="profile-link-settings"
            icon={<Icon name="impostazioni" size={20} color={colors.text} />}
            label={t('profile.settings')}
            onPress={() => router.push('/settings')}
            last
          />
        </Card>
      </ScrollView>
      <StatSheet visible={sheetOpen} detail={detail} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

interface LinkRowProps {
  readonly testID: string;
  readonly icon: ReactNode;
  readonly label: string;
  /** Shown at the right, before the arrow. */
  readonly value?: string;
  /** How the screen reader says the value, when it differs from the text. */
  readonly valueLabel?: string;
  readonly onPress: () => void;
  readonly last?: boolean;
}

/** A link of the Profile: icon, name, value and arrow (design-sezioni.md 9.7). */
function LinkRow({ testID, icon, label, value, valueLabel, onPress, last = false }: LinkRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const spoken = valueLabel ?? value;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        spoken === undefined ? label : t('profile.links.rowLabel', { label, value: spoken })
      }
      onPress={onPress}
      style={[
        styles.link,
        last ? null : { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
      ]}
    >
      <View
        style={styles.linkIcon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon}
      </View>
      <ThemedText variant="body" style={styles.flex}>
        {label}
      </ThemedText>
      {value === undefined ? null : (
        <ThemedText testID={`${testID}-value`} variant="label" color={colors.textMuted}>
          {value}
        </ThemedText>
      )}
      <Icon name="avanti" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 120 },
  gear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  identityStacked: { flexDirection: 'column' },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  pencil: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { gap: 4 },
  field: { minHeight: FIELD_HEIGHT, justifyContent: 'center' },
  input: { minHeight: FIELD_HEIGHT, paddingHorizontal: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  number: { flexGrow: 1, flexBasis: 80, alignItems: 'center', gap: 2 },
  center: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  links: { paddingVertical: 0 },
  link: { minHeight: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 16 },
  linkIcon: { width: COMPANION_ICON, alignItems: 'center' },
});
