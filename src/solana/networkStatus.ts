import type { SolanaNetwork } from './config';

export type NetworkStatusCopy = {
  label: 'Devnet' | 'Mainnet';
  detail: string;
  tone: 'devnet' | 'mainnet' | 'error';
};

export function getNetworkStatusCopy(
  network: SolanaNetwork,
  mainnetConfigured: boolean
): NetworkStatusCopy {
  if (network === 'devnet') {
    return {
      label: 'Devnet',
      detail: 'Test network. These NFTs are not mainnet assets.',
      tone: 'devnet',
    };
  }

  if (!mainnetConfigured) {
    return {
      label: 'Mainnet',
      detail: 'Mainnet RPC is not configured.',
      tone: 'error',
    };
  }

  return {
    label: 'Mainnet',
    detail: 'Real SOL is used for network fees.',
    tone: 'mainnet',
  };
}
