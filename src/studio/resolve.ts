import type { NftAttribute } from '../validation/attributes';
import { buildNftMetadata, type NftJsonMetadata } from '../metadata/buildNftMetadata';
import { buildStudioItemName, type StudioNumbering } from './numbering';
import type { StudioDefaults, StudioDraft, StudioDraftOverrides } from './types';

export type ResolvedDraftMetadata = {
  name: string;
  description: string;
  externalUrl: string;
  attributes: NftAttribute[];
  artworkName: string | null;
  nameIsOverride: boolean;
  descriptionIsOverride: boolean;
  externalUrlIsOverride: boolean;
  attributesAreOverride: boolean;
};

export type DraftEditorValues = {
  name: string;
  description: string;
  externalUrl: string;
  attributes: NftAttribute[];
};

export function attributesEqual(
  left: readonly NftAttribute[],
  right: readonly NftAttribute[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (item, index) =>
      item.trait_type === right[index]?.trait_type && item.value === right[index]?.value
  );
}

export function inheritedDraftName(draft: Pick<StudioDraft, 'number'>, numbering: StudioNumbering): string {
  return buildStudioItemName(numbering, draft.number);
}

export function resolveDraftMetadata(
  draft: StudioDraft,
  defaults: StudioDefaults,
  numbering: StudioNumbering
): ResolvedDraftMetadata {
  const overrides = draft.overrides ?? {};
  const nameIsOverride = Object.prototype.hasOwnProperty.call(overrides, 'name');
  const descriptionIsOverride = Object.prototype.hasOwnProperty.call(overrides, 'description');
  const externalUrlIsOverride = Object.prototype.hasOwnProperty.call(overrides, 'externalUrl');
  const attributesAreOverride = Object.prototype.hasOwnProperty.call(overrides, 'attributes');

  return {
    name: nameIsOverride ? overrides.name ?? '' : inheritedDraftName(draft, numbering),
    description: descriptionIsOverride ? overrides.description ?? '' : defaults.description,
    externalUrl: externalUrlIsOverride ? overrides.externalUrl ?? '' : defaults.externalUrl,
    attributes: attributesAreOverride ? [...(overrides.attributes ?? [])] : [...defaults.attributes],
    artworkName: draft.artwork?.name ?? null,
    nameIsOverride,
    descriptionIsOverride,
    externalUrlIsOverride,
    attributesAreOverride,
  };
}

function nextStringOverride(
  edited: string,
  inherited: string,
  hasExistingOverride: boolean
): string | undefined {
  if (hasExistingOverride) {
    return edited;
  }

  if (edited === inherited) {
    return undefined;
  }

  return edited;
}

function nextAttributesOverride(
  edited: NftAttribute[],
  inherited: readonly NftAttribute[],
  hasExistingOverride: boolean
): NftAttribute[] | undefined {
  if (hasExistingOverride) {
    return edited;
  }

  if (attributesEqual(edited, inherited)) {
    return undefined;
  }

  return edited;
}

export function applyDraftEditorValues(
  draft: StudioDraft,
  defaults: StudioDefaults,
  numbering: StudioNumbering,
  edited: DraftEditorValues
): StudioDraft {
  const previous = draft.overrides ?? {};
  const inheritedName = inheritedDraftName(draft, numbering);
  const name = edited.name.trim() || inheritedName;
  const description = edited.description;
  const externalUrl = edited.externalUrl.trim();
  const attributes = edited.attributes.map((item) => ({
    trait_type: item.trait_type.trim(),
    value: item.value.trim(),
  }));

  const nameOverride = nextStringOverride(
    name,
    inheritedName,
    Object.prototype.hasOwnProperty.call(previous, 'name')
  );
  const descriptionOverride = nextStringOverride(
    description,
    defaults.description,
    Object.prototype.hasOwnProperty.call(previous, 'description')
  );
  const externalUrlOverride = nextStringOverride(
    externalUrl,
    defaults.externalUrl,
    Object.prototype.hasOwnProperty.call(previous, 'externalUrl')
  );
  const attributesOverride = nextAttributesOverride(
    attributes,
    defaults.attributes,
    Object.prototype.hasOwnProperty.call(previous, 'attributes')
  );

  const overrides: StudioDraftOverrides = {};

  if (nameOverride !== undefined) {
    overrides.name = nameOverride;
  }

  if (descriptionOverride !== undefined) {
    overrides.description = descriptionOverride;
  }

  if (externalUrlOverride !== undefined) {
    overrides.externalUrl = externalUrlOverride;
  }

  if (attributesOverride !== undefined) {
    overrides.attributes = attributesOverride;
  }

  const resolvedName = nameOverride !== undefined ? nameOverride : inheritedName;

  return {
    ...draft,
    name: resolvedName,
    overrides,
    updatedAt: Date.now(),
  };
}

export function resolvedItemMetadataJson(
  draft: StudioDraft,
  defaults: StudioDefaults,
  numbering: StudioNumbering,
  creatorAddress = 'PreviewWallet111'
): Pick<NftJsonMetadata, 'name' | 'description' | 'attributes'> & {
  external_url?: string;
} {
  const resolved = resolveDraftMetadata(draft, defaults, numbering);
  const metadata = buildNftMetadata({
    name: resolved.name,
    symbol: defaults.symbol,
    description: resolved.description,
    imageIpfsUri: 'ipfs://preview',
    imageMimeType: draft.artwork?.type || 'image/png',
    externalUrl: resolved.externalUrl || undefined,
    attributes: resolved.attributes,
    creatorAddress,
  });

  return {
    name: metadata.name,
    description: metadata.description,
    attributes: metadata.attributes,
    ...(metadata.external_url ? { external_url: metadata.external_url } : {}),
  };
}
