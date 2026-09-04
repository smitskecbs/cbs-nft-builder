import { ALLOWED_ARTWORK_MIME_TYPES, MAX_UPLOAD_BYTES } from '../metadata/nftLimits';

const EXTENSION_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function isAllowedArtworkMimeType(mimeType: string): boolean {
  return (ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(
    mimeType.trim().toLowerCase()
  );
}

export function resolveArtworkMimeType(file: {
  type: string;
  name: string;
}): string {
  const declared = file.type.trim().toLowerCase();

  if (declared) {
    return declared;
  }

  const extension = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  return EXTENSION_MIME[extension] ?? '';
}

export function validateArtworkFile(file: {
  type: string;
  name: string;
  size: number;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (file.size <= 0) {
    return { ok: false, error: 'Select an artwork file before minting.' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: 'Artwork is too large. The maximum size is 2 MB.',
    };
  }

  const mimeType = resolveArtworkMimeType(file);

  if (!isAllowedArtworkMimeType(mimeType)) {
    return {
      ok: false,
      error: 'Artwork must be a PNG, JPEG, WebP, or GIF image.',
    };
  }

  return { ok: true, mimeType };
}
