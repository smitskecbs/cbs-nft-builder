import {
  getWallets,
} from '@wallet-standard/app';

export function getWalletStandardWallets() {
  const walletsApi =
    getWallets();

  return walletsApi.get();
}

export function findWalletStandardAccount(
  walletAddress: string
) {
  const wallets =
    getWalletStandardWallets();

  for (const wallet of wallets) {
    for (const account of wallet.accounts) {
      if (account.address === walletAddress) {
        return account;
      }
    }
  }

  return null;
}