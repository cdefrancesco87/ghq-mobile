import { Platform } from 'react-native';

import type { BackupErrorCode } from '@/db/repositories/settings';

// The cloud of the backup behind a small interface (backlog T57): iCloud on iPhone and the hidden
// space of the app on Google Drive on Android in the app (cloudStorage.ts), a store in memory in
// the tests.

/** Where the backups go: iCloud on iPhone, Google Drive on Android (design-sezioni.md 10.8). */
export type CloudProvider = 'icloud' | 'googledrive';

/** The cloud of the phone: iCloud on iPhone, Google Drive on Android. */
export function cloudProviderOf(os: string = Platform.OS): CloudProvider {
  return os === 'ios' ? 'icloud' : 'googledrive';
}

export interface CloudStore {
  readonly provider: CloudProvider;
  /** The bytes of a file, or null when it does not exist. */
  read(name: string): Promise<Uint8Array | null>;
  /** Writes a file, replacing it if it exists. */
  write(name: string, bytes: Uint8Array): Promise<void>;
}

/** A backup or a restore that did not work, with the reason the page explains. */
export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, options?: { cause?: unknown }) {
    super(`Backup failed: ${code}`, options);
    this.name = 'BackupError';
    this.code = code;
  }
}

/** The reason of any failure: `unknown` for the errors that are not a BackupError. */
export function backupErrorCode(error: unknown): BackupErrorCode {
  return error instanceof BackupError ? error.code : 'unknown';
}

export interface MemoryCloudStore extends CloudStore {
  readonly files: Map<string, Uint8Array>;
  /** The next read or write fails with this reason; null for none. */
  failNext: BackupErrorCode | null;
}

/** A cloud in memory, for the tests. */
export function createMemoryCloudStore(provider: CloudProvider = 'icloud'): MemoryCloudStore {
  const store: MemoryCloudStore = {
    provider,
    files: new Map(),
    failNext: null,
    read: async (name) => {
      fail();
      return store.files.get(name) ?? null;
    },
    write: async (name, bytes) => {
      fail();
      store.files.set(name, bytes.slice());
    },
  };
  const fail = () => {
    const code = store.failNext;
    if (code !== null) {
      store.failNext = null;
      throw new BackupError(code);
    }
  };
  return store;
}
