import type { SolanaNetwork } from './config';

const SOLSCAN_ORIGIN = 'https://solscan.io';

export function getExplorerTokenUrl(
  network: SolanaNetwork,
  mintAddress: string
): string {
  const url = `${SOLSCAN_ORIGIN}/token/${mintAddress}`;
  return network === 'devnet' ? `${url}?cluster=devnet` : url;
}

export function getExplorerTxUrl(
  network: SolanaNetwork,
  signature: string
): string {
  const url = `${SOLSCAN_ORIGIN}/tx/${signature}`;
  return network === 'devnet' ? `${url}?cluster=devnet` : url;
}

export function getExplorerNftUrl(
  network: SolanaNetwork,
  mintAddress: string
): string {
  const url = `${SOLSCAN_ORIGIN}/token/${mintAddress}`;
  return network === 'devnet' ? `${url}?cluster=devnet` : url;
}
