import { Keypair } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import { CAP_ACCOUNT_DISCRIMINATOR } from './program';
import {
  deriveCapPda,
  evaluateOnChainHardCapSignals,
  recognizeCbsHardCapCollection,
} from './recognize';

function encodeCap(mint: Uint8Array, locked: boolean): Uint8Array {
  const data = new Uint8Array(83);
  data.set(CAP_ACCOUNT_DISCRIMINATOR, 0);
  data[8] = 1;
  data[9] = 255;
  data[10] = locked ? 1 : 0;
  data.set(mint, 11);
  const view = new DataView(data.buffer);
  view.setUint32(43, 100, true);
  view.setUint32(47, 7, true);
  return data;
}

describe('CBS hard-cap recognition', () => {
  const programId = Keypair.generate().publicKey.toBase58();
  const mint = Keypair.generate().publicKey;
  const collectionMint = mint.toBase58();
  const capPda = deriveCapPda(collectionMint, programId);
  const lockedAccount = encodeCap(mint.toBytes(), true);

  it('does not recognize collections while integration is disabled', () => {
    const result = recognizeCbsHardCapCollection({
      network: 'devnet',
      expectedProgramId: programId,
      collectionMint,
      capAccount: lockedAccount,
      capAccountAddress: capPda,
      collectionUpdateAuthority: capPda,
    });
    expect(result).toEqual({
      recognized: false,
      reason: 'integration_disabled',
      capPda: null,
    });
  });

  it('hard-disables Mainnet while no approved Mainnet program ID exists', () => {
    const result = recognizeCbsHardCapCollection({
      network: 'mainnet',
      expectedProgramId: programId,
      collectionMint,
      capAccount: lockedAccount,
      capAccountAddress: capPda,
      collectionUpdateAuthority: capPda,
    });
    expect(result.recognized).toBe(false);
    expect(result.reason).toBe('mainnet_program_id_unset');
  });

  it('accepts locked PDA-authority state only as an on-chain signal, not a UI claim', () => {
    const result = evaluateOnChainHardCapSignals({
      expectedProgramId: programId,
      collectionMint,
      capAccount: lockedAccount,
      capAccountAddress: capPda,
      collectionUpdateAuthority: capPda,
    });
    expect(result).toEqual({ recognized: true, reason: 'ok', capPda });
  });

  it('rejects unlocked, wrong PDA, wrong mint, and wrong update authority', () => {
    expect(
      evaluateOnChainHardCapSignals({
        expectedProgramId: programId,
        collectionMint,
        capAccount: encodeCap(mint.toBytes(), false),
        capAccountAddress: capPda,
        collectionUpdateAuthority: capPda,
      }).reason
    ).toBe('not_locked');

    expect(
      evaluateOnChainHardCapSignals({
        expectedProgramId: programId,
        collectionMint,
        capAccount: lockedAccount,
        capAccountAddress: Keypair.generate().publicKey.toBase58(),
        collectionUpdateAuthority: capPda,
      }).reason
    ).toBe('pda_mismatch');

    expect(
      evaluateOnChainHardCapSignals({
        expectedProgramId: programId,
        collectionMint,
        capAccount: lockedAccount,
        capAccountAddress: capPda,
        collectionUpdateAuthority: Keypair.generate().publicKey.toBase58(),
      }).reason
    ).toBe('update_authority_not_pda');
  });
});
