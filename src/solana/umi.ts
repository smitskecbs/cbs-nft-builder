import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplToolbox } from '@metaplex-foundation/mpl-toolbox';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';

import { getRpc, type SolanaNetwork } from './config';
import type { SolanaWalletProvider } from './wallets';

export function createNftUmi(
  network: SolanaNetwork,
  walletProvider: SolanaWalletProvider
) {
  const umi = createUmi(getRpc(network));

  umi.use(mplToolbox());
  umi.use(mplTokenMetadata());
  umi.use(walletAdapterIdentity(walletProvider as never));

  return umi;
}
