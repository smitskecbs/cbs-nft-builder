export const MAX_NFT_NAME_LENGTH = 32;
export const MAX_NFT_SYMBOL_LENGTH = 10;
export const MAX_NFT_URI_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_ATTRIBUTE_COUNT = 20;
export const MAX_TRAIT_LENGTH = 32;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const ALLOWED_ARTWORK_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type AllowedArtworkMimeType =
  (typeof ALLOWED_ARTWORK_MIME_TYPES)[number];
