import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';

// The share of the CSV export (US-IMP-04; design-sezioni.md 10.8): the text is written in a file
// of the cache and handed to the system share sheet with expo-sharing. A development build made
// before T82 has no expo-sharing: the text is shared as a message instead, so the row still works.

/** UTF-8 byte order mark: spreadsheets read accented names right. */
const BOM = '﻿';

/** `ghq-export-2026-11-13.csv`, from the game day of the export. */
export function csvFileName(day: string): string {
  return `ghq-export-${day}.csv`;
}

/** Writes the CSV and opens the share sheet; resolves when the sheet is closed. */
export async function shareCsv(fileName: string, csv: string, title: string): Promise<void> {
  const sharing = await loadSharing();
  if (sharing === null) {
    await Share.share({ title, message: csv });
    return;
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(BOM + csv);
  await sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: title,
  });
}

type Sharing = typeof import('expo-sharing');

async function loadSharing(): Promise<Sharing | null> {
  try {
    const sharing = await import('expo-sharing');
    return (await sharing.isAvailableAsync()) ? sharing : null;
  } catch {
    return null;
  }
}
