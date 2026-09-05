import type { NftAttribute } from '../validation/attributes';
import type { SolanaNetwork } from '../solana/config';
import type { StudioNumbering } from './numbering';

export const DRAFT_STATUSES = [
  'draft',
  'artwork_uploaded',
  'metadata_ready',
  'mint_submitted',
  'minted',
  'collection_verified',
  'failed',
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const PREPARED_DRAFT_STATUSES: readonly DraftStatus[] = [
  'draft',
  'artwork_uploaded',
  'metadata_ready',
  'failed',
];

export const LOCKED_NUMBER_STATUSES: readonly DraftStatus[] = [
  'mint_submitted',
  'minted',
  'collection_verified',
];

export type StudioDefaults = {
  symbol: string;
  description: string;
  externalUrl: string;
  royaltyPercent: number;
  isMutable: boolean;
  attributes: NftAttribute[];
};

export type StudioDraftArtwork = {
  name: string;
  type: string;
  size: number;
};

/**
 * Present keys are item overrides. Missing keys inherit Collection Studio defaults
 * (or the numbered name). An explicit empty string is a stored override.
 */
export type StudioDraftOverrides = {
  name?: string;
  description?: string;
  externalUrl?: string;
  attributes?: NftAttribute[];
};

export type StudioDraft = {
  id: string;
  collectionKey: string;
  network: SolanaNetwork;
  collectionMint: string | null;
  number: number;
  name: string;
  status: DraftStatus;
  overrides: StudioDraftOverrides;
  artwork: StudioDraftArtwork | null;
  mintAddress: string | null;
  mintSignature?: string | null;
  staleMintAddress?: string | null;
  staleMintSignature?: string | null;
  sortIndex: number;
  createdAt: number;
  updatedAt: number;
};

type LegacyStudioDraftRecord = Partial<StudioDraft> & {
  descriptionOverride?: string;
  externalUrlOverride?: string;
  nameOverride?: string;
  attributes?: NftAttribute[];
  attributesOverride?: NftAttribute[] | null;
  signature?: string | null;
  transactionSignature?: string | null;
  mintResult?: {
    mint?: string | null;
    mintAddress?: string | null;
    signature?: string | null;
    transactionSignature?: string | null;
  };
};

function optionalProofString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function hasOnChainMintProof(draft: {
  mintAddress?: string | null;
  mintSignature?: string | null;
}): boolean {
  return Boolean(optionalProofString(draft.mintAddress) || optionalProofString(draft.mintSignature));
}

export function recoverUnprovenMintDraftStatus(status: DraftStatus, draft: {
  mintAddress?: string | null;
  mintSignature?: string | null;
}): DraftStatus {
  if (
    (status === 'mint_submitted' || status === 'minted' || status === 'collection_verified')
    && !hasOnChainMintProof(draft)
  ) {
    return 'failed';
  }

  return status;
}

export function normalizeStudioDraft(raw: unknown): StudioDraft {
  const record = (raw ?? {}) as LegacyStudioDraftRecord;
  const overrides: StudioDraftOverrides = { ...(record.overrides ?? {}) };

  if (!Object.prototype.hasOwnProperty.call(overrides, 'description')) {
    if (typeof record.descriptionOverride === 'string' && record.descriptionOverride !== '') {
      overrides.description = record.descriptionOverride;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, 'externalUrl')) {
    if (typeof record.externalUrlOverride === 'string' && record.externalUrlOverride !== '') {
      overrides.externalUrl = record.externalUrlOverride;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, 'name')) {
    if (typeof record.nameOverride === 'string' && record.nameOverride !== '') {
      overrides.name = record.nameOverride;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(overrides, 'attributes')) {
    if (Array.isArray(record.attributesOverride)) {
      overrides.attributes = record.attributesOverride;
    }
  }

  const mintResult =
    record.mintResult && typeof record.mintResult === 'object' ? record.mintResult : null;
  const mintAddress =
    optionalProofString(record.mintAddress) ??
    optionalProofString(mintResult?.mintAddress) ??
    optionalProofString(mintResult?.mint);
  const mintSignature =
    optionalProofString(record.mintSignature) ??
    optionalProofString(record.signature) ??
    optionalProofString(record.transactionSignature) ??
    optionalProofString(mintResult?.signature) ??
    optionalProofString(mintResult?.transactionSignature);
  const staleMintAddress = optionalProofString(record.staleMintAddress);
  const staleMintSignature = optionalProofString(record.staleMintSignature);
  const rawStatus = (record.status as DraftStatus) ?? 'draft';

  return {
    id: String(record.id ?? ''),
    collectionKey: String(record.collectionKey ?? ''),
    network: record.network === 'mainnet' ? 'mainnet' : 'devnet',
    collectionMint: record.collectionMint ?? null,
    number: Number(record.number) || 0,
    name: String(record.name ?? ''),
    status: recoverUnprovenMintDraftStatus(rawStatus, { mintAddress, mintSignature }),
    overrides,
    artwork: record.artwork ?? null,
    mintAddress,
    mintSignature,
    staleMintAddress,
    staleMintSignature,
    sortIndex: Number(record.sortIndex) || 0,
    createdAt: Number(record.createdAt) || 0,
    updatedAt: Number(record.updatedAt) || 0,
  };
}

export type StudioSettings = {
  collectionKey: string;
  numbering: StudioNumbering;
  defaults: StudioDefaults;
  collectionMint?: string;
  network?: SolanaNetwork;
  collectionName?: string;
  plannedCapacity?: number;
  created?: boolean;
  items?: Array<{
    mint: string;
    number: number;
    verified: boolean;
  }>;
};

export function normalizeStudioSettings(raw: unknown): StudioSettings | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Partial<StudioSettings>;

  if (
    typeof record.collectionKey !== 'string' ||
    !record.numbering ||
    typeof record.numbering !== 'object' ||
    !record.defaults ||
    typeof record.defaults !== 'object'
  ) {
    return null;
  }

  const items = Array.isArray(record.items)
    ? record.items.filter(
        (item): item is { mint: string; number: number; verified: boolean } =>
          !!item &&
          typeof item.mint === 'string' &&
          typeof item.number === 'number' &&
          typeof item.verified === 'boolean'
      )
    : undefined;

  return {
    collectionKey: record.collectionKey,
    numbering: record.numbering,
    defaults: record.defaults,
    collectionMint: typeof record.collectionMint === 'string' ? record.collectionMint : undefined,
    network:
      record.network === 'mainnet' || record.network === 'devnet' ? record.network : undefined,
    collectionName: typeof record.collectionName === 'string' ? record.collectionName : undefined,
    plannedCapacity:
      typeof record.plannedCapacity === 'number' ? record.plannedCapacity : undefined,
    created: record.created === true ? true : record.created === false ? false : undefined,
    items,
  };
}

export function isPreparedDraft(status: DraftStatus): boolean {
  return PREPARED_DRAFT_STATUSES.includes(status);
}

export function isNumberLocked(status: DraftStatus): boolean {
  return LOCKED_NUMBER_STATUSES.includes(status);
}

export function draftStatusLabel(status: DraftStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'artwork_uploaded':
      return 'Artwork ready';
    case 'metadata_ready':
      return 'Metadata ready';
    case 'mint_submitted':
      return 'Mint submitted';
    case 'minted':
      return 'Minted';
    case 'collection_verified':
      return 'Collection verified';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

/** Collection Manager labels for an existing collection NFT. */
export function collectionItemStatusLabel(status: DraftStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'artwork_uploaded':
    case 'metadata_ready':
      return 'Ready to mint';
    case 'mint_submitted':
      return 'Mint submitted';
    case 'minted':
      return 'Minted';
    case 'collection_verified':
      return 'Collection verified';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}
