import type { i18n as I18n } from 'i18next';
import { useEffect, useState } from 'react';

import { openAppDatabase } from '@/db/client';
import { createI18n } from '@/i18n';
import { startApp, useAppStore } from '@/stores/app';
import { useSettingsStore } from '@/stores/settings';

export interface Bootstrap {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: unknown;
  /** The language instance; null until the database is open and the language is known. */
  readonly i18n: I18n | null;
}

/**
 * Starts the app once (database, migrations, pending days, stores) and then gives the i18next
 * instance in the language of the settings, which follows the setting when it changes.
 */
export function useBootstrap(): Bootstrap {
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);
  const language = useSettingsStore((state) => state.settings.language);
  const [i18n, setI18n] = useState<I18n | null>(null);

  useEffect(() => {
    void startApp({ openDatabase: openAppDatabase });
  }, []);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }
    if (i18n !== null) {
      if (i18n.language !== language) {
        void i18n.changeLanguage(language);
      }
      return;
    }
    // A language that changes while the instance is being created cancels this attempt.
    let current = true;
    void createI18n(language).then((instance) => {
      if (current) {
        setI18n(instance);
      }
    });
    return () => {
      current = false;
    };
  }, [status, language, i18n]);

  return { status, error, i18n };
}
