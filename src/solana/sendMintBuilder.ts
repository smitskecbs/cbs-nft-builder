import type { Context, TransactionBuilder } from '@metaplex-foundation/umi';

import { logMintPipelineFlags, resolveMintOutcome } from './mintResult';

export async function sendMintBuilder(params: {
  umi: Pick<Context, 'transactions' | 'rpc' | 'payer'>;
  builder: TransactionBuilder;
  mintAddress: string;
}): Promise<{
  mintAddress: string;
  signature: string;
  confirmSucceeded: boolean;
  showIndexingNotice: boolean;
}> {
  let signatureRaw: unknown;
  let sendSucceeded = false;
  let confirmSucceeded = false;

  try {
    signatureRaw = await params.builder.send(params.umi);
    sendSucceeded = true;
  } catch (error) {
    logMintPipelineFlags({
      mintPublicKeyPresent: Boolean(params.mintAddress),
      transactionSignaturePresent: false,
      sendAndConfirmSuccess: false,
      postMintLookupSuccess: false,
    });
    throw error;
  }

  try {
    await params.builder.confirm(params.umi, signatureRaw as never, {
      commitment: 'confirmed',
    });
    confirmSucceeded = true;
  } catch {
    confirmSucceeded = false;
  }

  const outcome = resolveMintOutcome({
    mintAddress: params.mintAddress,
    signature: signatureRaw,
    sendSucceeded,
    confirmSucceeded,
  });

  logMintPipelineFlags({
    mintPublicKeyPresent: Boolean(params.mintAddress),
    transactionSignaturePresent: outcome.status === 'success',
    sendAndConfirmSuccess: sendSucceeded && confirmSucceeded,
    postMintLookupSuccess: confirmSucceeded,
  });

  if (outcome.status === 'failed') {
    throw new Error('Unable to format transaction signature.');
  }

  return {
    mintAddress: outcome.mintAddress,
    signature: outcome.signature,
    confirmSucceeded: outcome.confirmSucceeded,
    showIndexingNotice: outcome.showIndexingNotice,
  };
}
