import { tryFormatUmiTransactionSignature } from './formatSignature';

export const NFT_CREATED_HEADING = 'NFT created';

export const INDEXING_NOTICE =
  'NFT created successfully. Wallets and explorers may need a moment to index the NFT.';

export type MintDisplayModel = {
  name: string;
  mintAddress: string;
  signature: string;
  networkLabel: 'Mainnet' | 'Devnet';
  metadataUri: string;
  tokenStandard: 'NonFungible';
  artworkPreviewUrl: string | null;
  showIndexingNotice: boolean;
};

export type ResolvedMintOutcome =
  | {
      status: 'success';
      mintAddress: string;
      signature: string;
      confirmSucceeded: boolean;
      showIndexingNotice: boolean;
    }
  | {
      status: 'failed';
    };

export function hasMintPublicKey(mintAddress: string | null | undefined): boolean {
  return typeof mintAddress === 'string' && mintAddress.trim().length > 0;
}

export function logMintPipelineFlags(flags: {
  mintPublicKeyPresent: boolean;
  transactionSignaturePresent: boolean;
  sendAndConfirmSuccess: boolean;
  postMintLookupSuccess: boolean;
}): void {
  console.info('[nft-mint]', {
    mintPublicKeyPresent: flags.mintPublicKeyPresent ? 'YES' : 'NO',
    transactionSignaturePresent: flags.transactionSignaturePresent ? 'YES' : 'NO',
    sendAndConfirmSuccess: flags.sendAndConfirmSuccess ? 'YES' : 'NO',
    postMintLookupSuccess: flags.postMintLookupSuccess ? 'YES' : 'NO',
  });
}

/**
 * Primary success is a submitted mint: known mint signer + signature after send.
 * RPC confirm / indexer lookup is secondary and must not hide a confirmed submit.
 */
export function resolveMintOutcome(input: {
  mintAddress: string | null | undefined;
  signature: unknown;
  sendSucceeded: boolean;
  confirmSucceeded: boolean;
}): ResolvedMintOutcome {
  const mintAddress = hasMintPublicKey(input.mintAddress)
    ? input.mintAddress!.trim()
    : '';
  const signature = tryFormatUmiTransactionSignature(input.signature);

  if (!input.sendSucceeded || !mintAddress || !signature) {
    return { status: 'failed' };
  }

  return {
    status: 'success',
    mintAddress,
    signature,
    confirmSucceeded: input.confirmSucceeded,
    showIndexingNotice: !input.confirmSucceeded,
  };
}

export function resultRetryCreatesAnotherNft(): false {
  return false;
}

export function replayStoredMintDisplay(
  stored: MintDisplayModel | null
): MintDisplayModel | null {
  return stored;
}
