import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import {
  CloudStorage,
  CloudStorageError,
  CloudStorageErrorCode,
  CloudStorageProvider,
  CloudStorageScope,
} from 'react-native-cloud-storage';

import type { BackupErrorCode } from '@/db/repositories/settings';
import { BackupError, cloudProviderOf, type CloudStore } from './cloudStore';

// The real cloud of the backup with react-native-cloud-storage (stack-tecnologico.md, point 4):
// iCloud on iPhone, with no sign-in; on Android the hidden space of the app on Google Drive
// («appDataFolder»), where Google Sign-In only asks the permission for that space.

const DRIVE_APP_DATA = 'https://www.googleapis.com/auth/drive.appdata';
const MIME_TYPE = 'application/octet-stream';

/**
 * The web client id of Google (task C17 of Claudio): until it is set in app.json
 * (`extra.googleWebClientId`) Google Sign-In runs with the Android client of the package alone.
 */
const GOOGLE_CLIENT_PLACEHOLDER = 'C17-PLACEHOLDER';

function googleWebClientId(): string | undefined {
  const id: unknown = Constants.expoConfig?.extra?.googleWebClientId;
  return typeof id === 'string' && id !== '' && id !== GOOGLE_CLIENT_PLACEHOLDER ? id : undefined;
}

let googleConfigured = false;

/**
 * The access token to the space of the app on Google Drive. The sign-in is silent when the user
 * already gave the permission; otherwise, only when `interactive`, Google asks for it.
 */
async function googleAccessToken(interactive: boolean): Promise<string> {
  if (!googleConfigured) {
    GoogleSignin.configure({ scopes: [DRIVE_APP_DATA], webClientId: googleWebClientId() });
    googleConfigured = true;
  }
  try {
    let signedIn = (await GoogleSignin.signInSilently()).type === 'success';
    if (!signedIn && interactive) {
      await GoogleSignin.hasPlayServices();
      signedIn = (await GoogleSignin.signIn()).type === 'success';
    }
    if (!signedIn) {
      throw new BackupError('unavailable');
    }
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (error) {
    throw error instanceof BackupError ? error : new BackupError('unavailable', { cause: error });
  }
}

const ERROR_CODES: Partial<Record<CloudStorageErrorCode, BackupErrorCode>> = {
  [CloudStorageErrorCode.QUOTA_EXCEEDED]: 'no_space',
  [CloudStorageErrorCode.NETWORK_ERROR]: 'offline',
  [CloudStorageErrorCode.RATE_LIMITED]: 'offline',
  [CloudStorageErrorCode.FILE_NOT_DOWNLOADABLE]: 'offline',
  [CloudStorageErrorCode.AUTHENTICATION_FAILED]: 'unavailable',
  [CloudStorageErrorCode.ACCESS_TOKEN_MISSING]: 'unavailable',
  [CloudStorageErrorCode.UNSUPPORTED_PLATFORM]: 'unavailable',
};

function toBackupError(error: unknown): BackupError {
  if (error instanceof BackupError) {
    return error;
  }
  const code = error instanceof CloudStorageError ? ERROR_CODES[error.code] : undefined;
  return new BackupError(code ?? 'unknown', { cause: error });
}

const isNotFound = (error: unknown) =>
  error instanceof CloudStorageError && error.code === CloudStorageErrorCode.FILE_NOT_FOUND;

/**
 * The cloud of this phone. `interactive` lets Google ask for the permission (from the page
 * Backup); the automatic backup in the background never asks.
 */
export function createAppCloudStore({ interactive }: { interactive: boolean }): CloudStore {
  const provider = cloudProviderOf();
  const storage =
    provider === 'icloud'
      ? new CloudStorage(CloudStorageProvider.ICloud, { scope: CloudStorageScope.AppData })
      : new CloudStorage(CloudStorageProvider.GoogleDrive, {
          scope: CloudStorageScope.AppData,
          accessToken: () => googleAccessToken(interactive),
        });

  const ready = async () => {
    if (provider === 'icloud' && !(await storage.isCloudAvailable())) {
      throw new BackupError('unavailable');
    }
  };

  return {
    provider,
    read: async (name) => {
      try {
        await ready();
        const path = `/${name}`;
        if (provider === 'icloud') {
          // On a new iPhone the file may still be only in iCloud: ask for it first.
          await storage.triggerSync(path).catch(() => undefined);
        }
        return await storage.readFile(path, { format: 'bytes' });
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }
        throw toBackupError(error);
      }
    },
    write: async (name, bytes) => {
      try {
        await ready();
        await storage.writeFile(`/${name}`, bytes, { mimeType: MIME_TYPE });
      } catch (error) {
        throw toBackupError(error);
      }
    },
  };
}
