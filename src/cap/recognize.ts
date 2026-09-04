import { PublicKey } from '@solana/web3.js';

import {
  CAP_ACCOUNT_DISCRIMINATOR,
  collectionCapIntegrationEnabledForNetwork,
  collectionCapProgramIdForNetwork,
  type CollectionCapNetwork,
  CAP_PDA_SEED,
  CAP_VERSION_SEED,
} from './program';

export type HardCapRecognition = {
  recognized: boolean;
  reason:
    | 'integration_disabled'
    | 'not_cluster_deployed'
    | 'mainnet_program_id_unset'
    | 'program_id_unconfigured'
    | 'program_id_mismatch'
    | 'pda_mismatch'
    | 'state_invalid'
    | 'collection_mismatch'
    | 'update_authority_not_pda'
    | 'not_locked'
    | 'ok';
  capPda: string | null;
};

const utf8 = new TextEncoder();

export function deriveCapPda(collectionMint: string, programId: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      utf8.encode(CAP_PDA_SEED),
      utf8.encode(CAP_VERSION_SEED),
      new PublicKey(collectionMint).toBytes(),
    ],
    new PublicKey(programId)
  );
  return pda.toBase58();
}

/**
 * On-chain signal checks only. Does not enable UI copy.
 * A collection is a CBS hard-cap collection only when every check passes
 * and the live integration flags are on. Never use localStorage.
 */
export function evaluateOnChainHardCapSignals(input: {
  expectedProgramId: string;
  collectionMint: string;
  capAccount: Uint8Array | null;
  capAccountAddress: string | null;
  collectionUpdateAuthority: string | null;
}): HardCapRecognition {
  const capPda = deriveCapPda(input.collectionMint, input.expectedProgramId);
  if (input.capAccountAddress !== capPda) {
    return { recognized: false, reason: 'pda_mismatch', capPda };
  }
  if (!input.capAccount || input.capAccount.length < 83) {
    return { recognized: false, reason: 'state_invalid', capPda };
  }
  for (let i = 0; i < 8; i += 1) {
    if (input.capAccount[i] !== CAP_ACCOUNT_DISCRIMINATOR[i]) {
      return { recognized: false, reason: 'state_invalid', capPda };
    }
  }
  const version = input.capAccount[8];
  const locked = input.capAccount[10] !== 0;
  if (version !== 1) {
    return { recognized: false, reason: 'state_invalid', capPda };
  }
  const storedMint = new PublicKey(input.capAccount.subarray(11, 43)).toBase58();
  if (storedMint !== input.collectionMint) {
    return { recognized: false, reason: 'collection_mismatch', capPda };
  }
  if (!locked) {
    return { recognized: false, reason: 'not_locked', capPda };
  }
  if (input.collectionUpdateAuthority !== capPda) {
    return { recognized: false, reason: 'update_authority_not_pda', capPda };
  }
  return { recognized: true, reason: 'ok', capPda };
}

export function recognizeCbsHardCapCollection(input: {
  network: CollectionCapNetwork;
  expectedProgramId: string;
  collectionMint: string;
  capAccount: Uint8Array | null;
  capAccountAddress: string | null;
  collectionUpdateAuthority: string | null;
}): HardCapRecognition {
  if (!collectionCapIntegrationEnabledForNetwork(input.network)) {
    if (input.network === 'mainnet') {
      return { recognized: false, reason: 'mainnet_program_id_unset', capPda: null };
    }
    return { recognized: false, reason: 'integration_disabled', capPda: null };
  }

  const configured = collectionCapProgramIdForNetwork(input.network);
  if (input.network === 'mainnet' && configured === null) {
    return { recognized: false, reason: 'mainnet_program_id_unset', capPda: null };
  }
  if (configured === null) {
    return { recognized: false, reason: 'program_id_unconfigured', capPda: null };
  }
  if (input.expectedProgramId !== configured) {
    return { recognized: false, reason: 'program_id_mismatch', capPda: null };
  }
  return evaluateOnChainHardCapSignals(input);
}
