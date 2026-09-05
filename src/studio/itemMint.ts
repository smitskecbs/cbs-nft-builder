import { formatStudioItemNumber, type StudioNumbering } from './numbering';
import { duplicateMintBlocked } from './resume';
import { resolveDraftMetadata } from './resolve';
import { isNumberLocked, isPreparedDraft, recoverUnprovenMintDraftStatus, hasOnChainMintProof, type StudioDefaults, type StudioDraft } from './types';
import type { NftAttribute } from '../validation/attributes';

export type PreparedItemMint = {
  draftId: string;
  number: number;
  name: string;
  symbol: string;
  description: string;
  externalUrl: string;
  attributes: NftAttribute[];
  royaltyPercent: number;
  isMutable: boolean;
  artwork: StudioDraft['artwork'];
  mintLabel: string;
};

export function canMintStudioDraft(draft: StudioDraft): boolean {
  if (duplicateMintBlocked(draft).blocked) {
    return false;
  }

  return (
    Boolean(draft.collectionMint) &&
    !hasOnChainMintProof(draft) &&
    !isNumberLocked(recoverUnprovenMintDraftStatus(draft.status, draft)) &&
    isPreparedDraft(recoverUnprovenMintDraftStatus(draft.status, draft)) &&
    Boolean(draft.artwork)
  );
}

export function prepareItemMintFromDraft(
  draft: StudioDraft,
  defaults: StudioDefaults,
  numbering: StudioNumbering
): PreparedItemMint | { error: string } {
  if (!draft.collectionMint) {
    return { error: 'Open a created collection before minting an item.' };
  }

  const blocked = duplicateMintBlocked(draft);
  if (blocked.blocked) {
    return { error: blocked.reason };
  }

  if (!canMintStudioDraft(draft)) {
    return { error: `${draft.name} is not ready to mint.` };
  }

  const resolved = resolveDraftMetadata(draft, defaults, numbering);

  return {
    draftId: draft.id,
    number: draft.number,
    name: resolved.name,
    symbol: defaults.symbol,
    description: resolved.description,
    externalUrl: resolved.externalUrl,
    attributes: resolved.attributes,
    royaltyPercent: defaults.royaltyPercent,
    isMutable: defaults.isMutable,
    artwork: draft.artwork,
    mintLabel: `Mint ${formatStudioItemNumber(draft.number, numbering.digitCount)}`,
  };
}

export function assertMintTargetsDraft(
  prepared: PreparedItemMint,
  draft: StudioDraft
): { ok: true } | { ok: false; error: string } {
  if (prepared.draftId !== draft.id) {
    return { ok: false, error: 'Mint action does not match this draft.' };
  }

  if (prepared.number !== draft.number) {
    return { ok: false, error: `${prepared.mintLabel} cannot mint a different item.` };
  }

  return { ok: true };
}

export function managerHasMintAll(markup: string): boolean {
  return /mint\s+all/i.test(markup);
}

export function shouldMarkDraftFailedAfterMintError(
  draft: StudioDraft,
  chainMintAddress: string | null
): boolean {
  if (chainMintAddress || hasOnChainMintProof(draft)) {
    return false;
  }

  return true;
}

export function itemMintIsOneAtATime(): true {
  return true;
}
