import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';

export type ExistingNftSnapshot = {
  mint: string;
  name: string;
  tokenStandard: string | null;
  isMutable: boolean;
  updateAuthority: string;
  collectionKey: string | null;
  collectionVerified: boolean;
};

export type ExistingNftAttachPlan = {
  canAttempt: boolean;
  alreadyVerifiedHere: boolean;
  needsSetCollection: boolean;
  needsVerify: boolean;
  blockedReason: string | null;
  requiredSigners: string[];
  instructions: string[];
};

export function analyzeExistingNftForCollection(params: {
  nft: ExistingNftSnapshot;
  collectionMint: string;
  walletAddress: string;
  collectionUpdateAuthority: string;
}): ExistingNftAttachPlan {
  const requiredSigners: string[] = [];
  const instructions: string[] = [];

  if (params.nft.tokenStandard !== 'NonFungible') {
    return {
      canAttempt: false,
      alreadyVerifiedHere: false,
      needsSetCollection: false,
      needsVerify: false,
      blockedReason: 'Only Metaplex NonFungible NFTs can be added. This mint is not NonFungible.',
      requiredSigners: [],
      instructions: [],
    };
  }

  if (
    params.nft.collectionKey &&
    params.nft.collectionKey !== params.collectionMint &&
    params.nft.collectionVerified
  ) {
    return {
      canAttempt: false,
      alreadyVerifiedHere: false,
      needsSetCollection: false,
      needsVerify: false,
      blockedReason:
        'This NFT is already verified in a different collection. V1 does not move it automatically.',
      requiredSigners: [],
      instructions: [],
    };
  }

  if (params.nft.collectionKey === params.collectionMint && params.nft.collectionVerified) {
    return {
      canAttempt: false,
      alreadyVerifiedHere: true,
      needsSetCollection: false,
      needsVerify: false,
      blockedReason: 'This NFT is already verified in this collection. Do not mint it again.',
      requiredSigners: [],
      instructions: [],
    };
  }

  const needsSetCollection = params.nft.collectionKey !== params.collectionMint;
  const needsVerify = !params.nft.collectionVerified || needsSetCollection;

  if (needsSetCollection && !params.nft.isMutable) {
    return {
      canAttempt: false,
      alreadyVerifiedHere: false,
      needsSetCollection: true,
      needsVerify,
      blockedReason: 'Metadata is immutable, so the collection field cannot be set.',
      requiredSigners: [],
      instructions: [],
    };
  }

  if (needsSetCollection && params.nft.updateAuthority !== params.walletAddress) {
    return {
      canAttempt: false,
      alreadyVerifiedHere: false,
      needsSetCollection: true,
      needsVerify,
      blockedReason: 'Connected wallet is not the update authority of this NFT.',
      requiredSigners: [],
      instructions: [],
    };
  }

  if (needsVerify && params.collectionUpdateAuthority !== params.walletAddress) {
    return {
      canAttempt: false,
      alreadyVerifiedHere: false,
      needsSetCollection,
      needsVerify: true,
      blockedReason: 'Connected wallet is not the collection update authority.',
      requiredSigners: [],
      instructions: [],
    };
  }

  if (needsSetCollection) {
    requiredSigners.push('NFT update authority');
    instructions.push('updateV1 (collectionToggle Set, verified false)');
  }

  if (needsVerify) {
    requiredSigners.push('Collection update authority');
    instructions.push('verifyCollectionV1');
  }

  return {
    canAttempt: true,
    alreadyVerifiedHere: false,
    needsSetCollection,
    needsVerify,
    blockedReason: null,
    requiredSigners: [...new Set(requiredSigners)],
    instructions,
  };
}

export function isNonFungibleStandard(value: TokenStandard | number | string | null): boolean {
  return value === TokenStandard.NonFungible || value === 'NonFungible' || value === 0;
}
