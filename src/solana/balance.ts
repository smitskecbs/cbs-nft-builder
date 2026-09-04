import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { getRpc, RPC_COMMITMENT, type SolanaNetwork } from './config';

export const MIN_NFT_MINT_LAMPORTS = 20_000_000;

export async function getWalletLamports(
  network: SolanaNetwork,
  walletAddress: string
): Promise<number> {
  const connection = new Connection(getRpc(network), RPC_COMMITMENT);
  return connection.getBalance(new PublicKey(walletAddress));
}

export function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}
