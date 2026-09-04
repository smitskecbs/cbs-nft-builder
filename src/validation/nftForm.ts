import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NFT_NAME_LENGTH,
  MAX_NFT_SYMBOL_LENGTH,
} from '../metadata/nftLimits';
import { normalizeAttributes, type NftAttribute } from './attributes';
import { validateArtworkFile } from './artwork';
import { parseRoyaltyPercent } from './royalties';

export type UniqueNftFormInput = {
  name: string;
  symbol: string;
  description: string;
  externalUrl: string;
  royaltyPercent: string;
  isMutable: boolean;
  creatorAddress: string;
  attributes: Array<{ trait_type: string; value: string }>;
  artwork: { type: string; name: string; size: number } | null;
};

export type ValidatedUniqueNftForm = {
  name: string;
  symbol: string;
  description: string;
  externalUrl: string;
  royaltyPercent: number;
  royaltyBasisPoints: number;
  isMutable: boolean;
  creatorAddress: string;
  attributes: NftAttribute[];
  artworkMimeType: string;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateUniqueNftForm(
  input: UniqueNftFormInput
): { ok: true; value: ValidatedUniqueNftForm } | { ok: false; error: string } {
  const name = input.name.trim();

  if (!name) {
    return { ok: false, error: 'Name is required.' };
  }

  if (name.length > MAX_NFT_NAME_LENGTH) {
    return {
      ok: false,
      error: `Name can be at most ${MAX_NFT_NAME_LENGTH} characters.`,
    };
  }

  const symbol = input.symbol.trim();

  if (symbol.length > MAX_NFT_SYMBOL_LENGTH) {
    return {
      ok: false,
      error: `Symbol can be at most ${MAX_NFT_SYMBOL_LENGTH} characters.`,
    };
  }

  const description = input.description.trim();

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description can be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    };
  }

  const externalUrl = input.externalUrl.trim();

  if (externalUrl && !isHttpUrl(externalUrl)) {
    return {
      ok: false,
      error: 'External URL must start with http:// or https://.',
    };
  }

  const royalty = parseRoyaltyPercent(input.royaltyPercent);

  if (!royalty.ok) {
    return royalty;
  }

  if (!input.creatorAddress.trim()) {
    return { ok: false, error: 'Connect a wallet before minting.' };
  }

  const attributes = normalizeAttributes(input.attributes);

  if (!attributes.ok) {
    return attributes;
  }

  if (!input.artwork) {
    return { ok: false, error: 'Select an artwork file before minting.' };
  }

  const artwork = validateArtworkFile(input.artwork);

  if (!artwork.ok) {
    return artwork;
  }

  return {
    ok: true,
    value: {
      name,
      symbol,
      description,
      externalUrl,
      royaltyPercent: royalty.percent,
      royaltyBasisPoints: royalty.basisPoints,
      isMutable: input.isMutable,
      creatorAddress: input.creatorAddress.trim(),
      attributes: attributes.attributes,
      artworkMimeType: artwork.mimeType,
    },
  };
}
