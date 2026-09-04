import { MAX_ATTRIBUTE_COUNT, MAX_TRAIT_LENGTH } from '../metadata/nftLimits';

export type NftAttributeInput = {
  trait_type: string;
  value: string;
};

export type NftAttribute = {
  trait_type: string;
  value: string;
};

export function normalizeAttributes(
  attributes: NftAttributeInput[]
): { ok: true; attributes: NftAttribute[] } | { ok: false; error: string } {
  if (attributes.length > MAX_ATTRIBUTE_COUNT) {
    return {
      ok: false,
      error: `You can add up to ${MAX_ATTRIBUTE_COUNT} attributes.`,
    };
  }

  const normalized: NftAttribute[] = [];

  for (const attribute of attributes) {
    const trait_type = attribute.trait_type.trim();
    const value = attribute.value.trim();

    if (!trait_type && !value) {
      continue;
    }

    if (!trait_type || !value) {
      return {
        ok: false,
        error: 'Each attribute needs both a trait type and a value.',
      };
    }

    if (trait_type.length > MAX_TRAIT_LENGTH || value.length > MAX_TRAIT_LENGTH) {
      return {
        ok: false,
        error: `Attribute fields can be at most ${MAX_TRAIT_LENGTH} characters.`,
      };
    }

    normalized.push({ trait_type, value });
  }

  return { ok: true, attributes: normalized };
}
