import { validateArtworkFile } from '../validation/artwork';
import type { StudioDraftArtwork } from './types';

export type ArtworkImportResult = {
  accepted: Array<{ file: File; artwork: StudioDraftArtwork }>;
  rejected: Array<{ name: string; error: string }>;
};

function toArtworkMeta(file: File, mimeType: string): StudioDraftArtwork {
  return {
    name: file.name,
    type: mimeType,
    size: file.size,
  };
}

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

export function classifyArtworkFiles(files: readonly File[]): ArtworkImportResult {
  const accepted: ArtworkImportResult['accepted'] = [];
  const rejected: ArtworkImportResult['rejected'] = [];

  for (const file of files) {
    const validated = validateArtworkFile(file);

    if (!validated.ok) {
      rejected.push({ name: file.name, error: validated.error });
      continue;
    }

    accepted.push({
      file,
      artwork: toArtworkMeta(file, validated.mimeType),
    });
  }

  return { accepted, rejected };
}

type FileSystemFileEntryLike = {
  isFile: true;
  isDirectory: false;
  file: (success: (file: File) => void, error?: (err: DOMException) => void) => void;
};

type FileSystemDirectoryEntryLike = {
  isFile: false;
  isDirectory: true;
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: DOMException) => void
    ) => void;
  };
};

type FileSystemEntryLike = FileSystemFileEntryLike | FileSystemDirectoryEntryLike;

function asEntry(item: DataTransferItem): FileSystemEntryLike | null {
  const maybe = item as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntry | null;
  };
  const entry = maybe.webkitGetAsEntry?.() ?? null;

  if (!entry) {
    return null;
  }

  if (entry.isFile) {
    return entry as unknown as FileSystemFileEntryLike;
  }

  if (entry.isDirectory) {
    return entry as unknown as FileSystemDirectoryEntryLike;
  }

  return null;
}

function readFileEntry(entry: FileSystemFileEntryLike): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readDirectoryEntry(entry: FileSystemDirectoryEntryLike): Promise<File[]> {
  const reader = entry.createReader();
  const files: File[] = [];

  const readBatch = (): Promise<FileSystemEntryLike[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

  let batch = await readBatch();

  while (batch.length > 0) {
    for (const child of batch) {
      if (child.isFile) {
        files.push(await readFileEntry(child));
      } else if (child.isDirectory) {
        files.push(...(await readDirectoryEntry(child)));
      }
    }

    batch = await readBatch();
  }

  return files;
}

export async function collectFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);

  if (items.length > 0 && items.some((item) => typeof (item as DataTransferItem & { webkitGetAsEntry?: unknown }).webkitGetAsEntry === 'function')) {
    const collected: File[] = [];

    for (const item of items) {
      const entry = asEntry(item);

      if (!entry) {
        const file = item.getAsFile();
        if (file) {
          collected.push(file);
        }
        continue;
      }

      if (entry.isFile) {
        collected.push(await readFileEntry(entry));
      } else if (entry.isDirectory) {
        collected.push(...(await readDirectoryEntry(entry)));
      }
    }

    if (collected.length > 0) {
      return collected;
    }
  }

  return Array.from(dataTransfer.files ?? []).filter(isFile);
}

export async function collectArtworkFiles(source: FileList | File[] | DataTransfer): Promise<File[]> {
  if (typeof DataTransfer !== 'undefined' && source instanceof DataTransfer) {
    return collectFilesFromDataTransfer(source);
  }

  return Array.from(source as FileList | File[]).filter(isFile);
}
