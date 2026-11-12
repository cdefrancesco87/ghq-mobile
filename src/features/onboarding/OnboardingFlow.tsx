import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  RECOMMENDED_TEMPLATE_KEYS,
  createProfile,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '@/db/repositories/onboarding';
import { SETTING_DEFAULTS, type OnboardingDraft } from '@/db/repositories/settings';
import { ThemeCarousel } from '@/features/shared/ThemeCarousel';
import { UndoToastProvider } from '@/features/shared/UndoToast';
import { runAction, useAppStore } from '@/stores/app';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { LanguageStep } from './LanguageStep';
import { MissionsStep } from './MissionsStep';
import { NameStep } from './NameStep';
import { NotificationsStep } from './NotificationsStep';
import { OnboardingStep, StepButton } from './OnboardingStep';

/** Steps 1 and 2 are in Minimal; from here on the flow takes the chosen theme (design 1.1). */
const FIRST_THEMED_STEP = 3;
/** The tallest title of the themes on Android (Chakra Petch 22): the step does not move. */
const THEME_TITLE_HEIGHT = 40;
/** The name is saved when typing pauses, not at every key: each save also reloads the stores. */
export const NAME_SAVE_DELAY_MS = 400;

/**
 * The five steps of the first launch (design-sezioni.md 1.1). Every choice goes into the draft at
 * once (the name when typing pauses), so the flow resumes from the step left; the language is
 * already a setting of its own.
 */
export function OnboardingFlow() {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.settings.language);
  const [draft, setDraft] = useState(() => loadOnboardingDraft(getSession().db));
  const pendingName = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(pendingName.current), []);

  const save = (next: OnboardingDraft) => {
    // Any save writes the whole draft, so it also covers a name still waiting.
    clearTimeout(pendingName.current);
    runAction((db, { now }) => saveOnboardingDraft(db, next, now));
  };
  const update = (changes: Partial<OnboardingDraft>) => {
    const next = { ...draft, ...changes };
    save(next);
    setDraft(next);
  };
  const changeName = (name: string) => {
    const next = { ...draft, name };
    clearTimeout(pendingName.current);
    pendingName.current = setTimeout(() => save(next), NAME_SAVE_DELAY_MS);
    setDraft(next);
  };
  const finish = () => {
    // A double tap reaches here twice before the flow goes away.
    if (useAppStore.getState().hasProfile) {
      return;
    }
    runAction((db, clock) =>
      createProfile(
        db,
        {
          name: draft.name,
          language,
          theme: draft.theme,
          templateKeys: draft.templateKeys,
        },
        { ...clock, translate: (key) => t(key) },
      ),
    );
  };

  return (
    <ThemeProvider theme={draft.step < FIRST_THEMED_STEP ? 'minimal' : draft.theme}>
      {stepOf(draft.step)}
    </ThemeProvider>
  );

  function stepOf(step: OnboardingDraft['step']) {
    switch (step) {
      case 1:
        return <LanguageStep onContinue={() => update({ step: 2 })} />;
      case 2:
        return (
          <NameStep
            name={draft.name}
            onChangeName={changeName}
            onBack={() => update({ step: 1 })}
            onContinue={() => update({ step: 3 })}
          />
        );
      case 3:
        return (
          <OnboardingStep
            name="theme"
            title={t('onboarding.theme.title')}
            titleMinHeight={THEME_TITLE_HEIGHT}
            onBack={() => update({ step: 2 })}
            onSkip={() => update({ step: 4, theme: SETTING_DEFAULTS.theme })}
            footer={
              <StepButton
                testID="onboarding-continue"
                label={t('onboarding.continue')}
                onPress={() => update({ step: 4 })}
              />
            }
          >
            <ThemeCarousel
              value={draft.theme}
              heroName={draft.name.trim()}
              onChange={(theme) => update({ theme })}
            />
          </OnboardingStep>
        );
      case 4:
        // Its own provider: the notice takes the theme of the flow and ends with the step.
        return (
          <UndoToastProvider>
            <MissionsStep
              selected={draft.templateKeys}
              onChangeSelected={(templateKeys) => update({ templateKeys })}
              onBack={() => update({ step: 3 })}
              onSkip={() => update({ step: 5, templateKeys: RECOMMENDED_TEMPLATE_KEYS })}
              onContinue={() => update({ step: 5 })}
            />
          </UndoToastProvider>
        );
      case 5:
        return <NotificationsStep onBack={() => update({ step: 4 })} onFinish={finish} />;
    }
  }
}
