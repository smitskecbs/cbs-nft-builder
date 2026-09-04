import {
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  getWallets,
} from '@wallet-standard/app';

import {
  getWalletStandardWallets,
} from './walletStandard';

import type {
  SolanaNetwork,
} from './config';

import {
  adaptWalletProvider,
  normalizeWalletPublicKey,
} from './walletPublicKey';

export {
  adaptWalletProvider,
  connectAndNormalizeWalletPublicKey,
  getWalletPublicKeyDebugInfo,
  logWalletDebug,
  normalizeWalletPublicKey,
  readWalletPublicKey,
  toWalletPublicKey,
  WALLET_PUBLIC_KEY_READ_ERROR,
} from './walletPublicKey';

import {
  PublicKey,
} from '@solana/web3.js';

export type SolanaWalletProvider = {
  connect?: (
    options?: {
      onlyIfTrusted?: boolean;
    }
  ) => Promise<{
    publicKey:
      | PublicKey
      | {
          toString(): string;
        };
  }>;

  disconnect?: () => Promise<void>;

  publicKey?:
    | PublicKey
    | {
        toString(): string;
      };

  signTransaction?: (
    transaction: unknown
  ) => Promise<unknown>;

  signAllTransactions?: (
    transactions: unknown[]
  ) => Promise<unknown[]>;

  signAndSendTransaction?: (
    transaction: unknown,
    options?: unknown
  ) => Promise<{
    signature: string;
  }>;

  signMessage?: (
    message: Uint8Array,
    display?: string
  ) => Promise<{
    signature: Uint8Array;
  }>;
};

export type DetectedWallet = {
  id: string;
  name: string;
  provider: SolanaWalletProvider;
  source:
    | 'injected'
    | 'wallet-standard';
};

export const WALLET_UNSUPPORTED_SIGNING_MESSAGE =
  'This wallet does not support the required signing method for NFT creation.';

declare global {
  interface Window {
    phantom?: {
      solana?: SolanaWalletProvider;
    };

    solana?: SolanaWalletProvider & {
      isPhantom?: boolean;
      isSolflare?: boolean;
      isBackpack?: boolean;
      isGlow?: boolean;
    };

    solflare?: SolanaWalletProvider;

    backpack?: {
      solana?: SolanaWalletProvider;
    };

    glow?: {
      solana?: SolanaWalletProvider;
    } | SolanaWalletProvider;
  }
}

const SOLANA_CHAIN_PREFIX =
  'solana:';

const ALLOWED_INJECTED_WALLET_IDS =
  new Set([
    'phantom',
    'solflare',
    'backpack',
    'glow',
  ]);

type WalletStandardWallet =
  ReturnType<
    typeof getWalletStandardWallets
  >[number];

type NetworkResolver =
  () => SolanaNetwork;

let networkResolver:
  NetworkResolver = () =>
    'devnet';

const providerRegistry =
  new Map<
    string,
    DetectedWallet
  >();

export function setWalletNetworkResolver(
  resolver: NetworkResolver
) {
  networkResolver =
    resolver;
}

function walletChainId(): string {
  return networkResolver() ===
    'mainnet'
    ? 'solana:mainnet'
    : 'solana:devnet';
}

function hasConnectMethod(
  provider: SolanaWalletProvider
): boolean {
  return (
    typeof provider.connect ===
    'function'
  );
}

function isLikelySolanaAddress(
  address: string
): boolean {
  const trimmed =
    address.trim();

  if (
    !trimmed ||
    trimmed.startsWith(
      '0x'
    )
  ) {
    return false;
  }

  return (
    trimmed.length >=
      32 &&
    trimmed.length <=
      44
  );
}

function isMetaMaskInjectedProvider(
  provider: unknown
): boolean {
  return Boolean(
    (
      provider as {
        isMetaMask?: boolean;
      }
    ).isMetaMask
  );
}

function hasSolanaSigningCapability(
  provider: SolanaWalletProvider
): boolean {
  const normalized =
    normalizeProvider(
      provider
    );

  return (
    typeof normalized.signTransaction ===
      'function' ||
    typeof provider.signAndSendTransaction ===
      'function'
  );
}

function hasSolanaPublicKeySupport(
  provider: SolanaWalletProvider
): boolean {
  if (
    !provider.publicKey
  ) {
    return true;
  }

  try {
    return isLikelySolanaAddress(
      normalizeWalletPublicKey(
        provider.publicKey
      )
    );
  } catch {
    return false;
  }
}

function isAllowedInjectedSolanaWallet(
  provider: SolanaWalletProvider
): boolean {
  if (
    isMetaMaskInjectedProvider(
      provider
    )
  ) {
    return false;
  }

  if (
    !hasConnectMethod(
      provider
    )
  ) {
    return false;
  }

  if (
    !hasSolanaPublicKeySupport(
      provider
    )
  ) {
    return false;
  }

  return hasSolanaSigningCapability(
    provider
  );
}

function accountSupportsSolana(
  account: {
    address: string;
    chains?: readonly string[];
  }
): boolean {
  if (
    !isLikelySolanaAddress(
      account.address
    )
  ) {
    return false;
  }

  if (
    !account.chains ||
    account.chains.length ===
      0
  ) {
    return true;
  }

  return account.chains.some(
    (
      chain
    ) =>
      chain.startsWith(
        SOLANA_CHAIN_PREFIX
      )
  );
}

function walletStandardHasSolanaSigningFeatures(
  wallet: WalletStandardWallet
): boolean {
  return (
    'solana:signTransaction' in
      wallet.features ||
    'solana:signAndSendTransaction' in
      wallet.features
  );
}

function isEvmOnlyWalletStandardWallet(
  wallet: WalletStandardWallet
): boolean {
  if (
    walletStandardHasSolanaSigningFeatures(
      wallet
    )
  ) {
    return false;
  }

  const featureNames =
    Object.keys(
      wallet.features
    );

  const hasEvmFeatures =
    featureNames.some(
      (
        feature
      ) =>
        feature.startsWith(
          'eip155:'
        ) ||
        feature.startsWith(
          'ethereum:'
        )
    );

  if (
    !hasEvmFeatures
  ) {
    return false;
  }

  if (
    wallet.accounts.length ===
    0
  ) {
    return true;
  }

  return wallet.accounts.every(
    (
      account
    ) => {
      const address =
        account.address.trim();

      if (
        address.startsWith(
          '0x'
        )
      ) {
        return true;
      }

      return (
        account.chains?.every(
          (
            chain
          ) =>
            chain.startsWith(
              'eip155:'
            )
        ) ??
        false
      );
    }
  );
}

function isSolanaWalletStandardWallet(
  wallet: WalletStandardWallet
): boolean {
  if (
    !(
      'standard:connect' in
      wallet.features
    )
  ) {
    return false;
  }

  if (
    !walletStandardHasSolanaSigningFeatures(
      wallet
    )
  ) {
    return false;
  }

  if (
    isEvmOnlyWalletStandardWallet(
      wallet
    )
  ) {
    return false;
  }

  if (
    wallet.accounts.length >
    0
  ) {
    const hasSolanaAccount =
      wallet.accounts.some(
        accountSupportsSolana
      );

    if (
      !hasSolanaAccount &&
      !walletStandardHasSolanaSigningFeatures(
        wallet
      )
    ) {
      return false;
    }
  }

  return true;
}

function walletStandardWalletId(
  wallet: WalletStandardWallet
): string {
  const normalizedName =
    wallet.name
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-|-$/g,
        ''
      );

  if (
    normalizedName.includes(
      'metamask'
    )
  ) {
    return 'metamask-solana';
  }

  return `ws-${normalizedName}`;
}

function normalizeSignMessageResult(
  result: unknown
): {
  signature: Uint8Array;
} {
  if (
    !result ||
    typeof result !==
      'object'
  ) {
    throw new Error(
      'Wallet did not return a message signature.'
    );
  }

  const signature = (
    result as {
      signature?: unknown;
    }
  ).signature;

  if (
    signature instanceof
    Uint8Array
  ) {
    return {
      signature,
    };
  }

  if (
    Array.isArray(
      signature
    )
  ) {
    return {
      signature:
        Uint8Array.from(
          signature
        ),
    };
  }

  throw new Error(
    'Wallet did not return a message signature.'
  );
}

function getInjectedSignMessageFn(
  walletId: string
):
  | ((
      message: Uint8Array,
      display?: string
    ) => Promise<unknown>)
  | null {
  switch (walletId) {
    case 'phantom': {
      const provider =
        window.phantom
          ?.solana;

      if (
        typeof provider?.signMessage ===
        'function'
      ) {
        return provider.signMessage.bind(
          provider
        );
      }

      return null;
    }
    case 'solflare': {
      const provider =
        window.solflare;

      if (
        typeof provider?.signMessage ===
        'function'
      ) {
        return provider.signMessage.bind(
          provider
        );
      }

      return null;
    }
    case 'backpack': {
      const provider =
        window.backpack
          ?.solana;

      if (
        typeof provider?.signMessage ===
        'function'
      ) {
        return provider.signMessage.bind(
          provider
        );
      }

      return null;
    }
    case 'glow': {
      const glow =
        window.glow;
      const provider =
        (
          glow as
            | {
                solana?: SolanaWalletProvider;
              }
            | undefined
        )?.solana ??
        (glow as
          | SolanaWalletProvider
          | undefined);

      if (
        typeof provider?.signMessage ===
        'function'
      ) {
        return provider.signMessage.bind(
          provider
        );
      }

      return null;
    }
    default: {
      const provider =
        window.solana;

      if (
        typeof provider?.signMessage ===
        'function'
      ) {
        return provider.signMessage.bind(
          provider
        );
      }

      return null;
    }
  }
}

function enrichProviderSignMessage(
  provider: SolanaWalletProvider,
  walletId: string
): SolanaWalletProvider {
  if (
    typeof provider.signMessage ===
    'function'
  ) {
    return provider;
  }

  const injectedSignMessage =
    getInjectedSignMessageFn(
      walletId
    );

  if (
    !injectedSignMessage
  ) {
    return provider;
  }

  return {
    ...provider,
    async signMessage(
      message,
      display
    ) {
      const result =
        await injectedSignMessage(
          message,
          display ??
            'utf8'
        );

      return normalizeSignMessageResult(
        result
      );
    },
  };
}

export function walletSupportsUploadAuthorization(
  provider: SolanaWalletProvider
): boolean {
  return (
    typeof provider.signMessage ===
    'function'
  );
}

export function logUploadAuthorizationWalletDebug(
  walletId: string,
  provider: SolanaWalletProvider
): void {
  if (
    !import.meta.env.DEV
  ) {
    return;
  }

  const detected =
    getDetectedWallet(
      walletId
    );

  const walletStandardWallet =
    detected?.source ===
    'wallet-standard'
      ? getWalletStandardWallets().find(
          (
            wallet
          ) =>
            walletStandardWalletId(
              wallet
            ) ===
            walletId
        )
      : undefined;

  console.log(
    '[upload-auth] wallet debug',
    {
      walletName:
        detected?.name ??
        walletId,
      walletId,
      providerSource:
        detected?.source ??
        'unknown',
      hasSignMessage:
        typeof provider.signMessage ===
        'function',
      walletStandardFeatures:
        walletStandardWallet
          ? Object.keys(
              walletStandardWallet.features
            )
          : undefined,
      hasWalletStandardSignMessage:
        Boolean(
          walletStandardWallet?.features[
            'solana:signMessage'
          ]
        ),
      hasInjectedSignMessage:
        Boolean(
          getInjectedSignMessageFn(
            walletId
          )
        ),
    }
  );
}

export function prepareProviderForUploadAuth(
  provider: SolanaWalletProvider,
  walletId: string
): SolanaWalletProvider {
  return enrichProviderSignMessage(
    adaptWalletProvider(
      provider
    ),
    walletId
  );
}

function normalizeProvider(
  provider: SolanaWalletProvider
): SolanaWalletProvider {
  if (
    typeof provider.signTransaction ===
    'function'
  ) {
    return provider;
  }

  if (
    typeof provider.signAllTransactions ===
    'function'
  ) {
    return {
      ...provider,
      signTransaction:
        async (
          transaction: unknown
        ) => {
          const signed =
            await provider.signAllTransactions!(
              [
                transaction,
              ]
            );

          return signed[0];
        },
    };
  }

  return provider;
}

export function walletSupportsTokenCreation(
  provider: SolanaWalletProvider
): boolean {
  const normalized =
    normalizeProvider(
      provider
    );

  return (
    typeof normalized.signTransaction ===
    'function'
  );
}

function transactionToBytes(
  transaction: unknown
): Uint8Array {
  if (
    transaction instanceof
    Uint8Array
  ) {
    return transaction;
  }

  if (
    transaction instanceof
    Transaction
  ) {
    return transaction.serialize(
      {
        requireAllSignatures:
          false,
        verifySignatures:
          false,
      }
    );
  }

  if (
    transaction instanceof
    VersionedTransaction
  ) {
    return transaction.serialize();
  }

  const maybeSerialize =
    transaction as {
      serialize?: () => Uint8Array;
    };

  if (
    typeof maybeSerialize.serialize ===
    'function'
  ) {
    const serialized =
      maybeSerialize.serialize();

    if (
      serialized instanceof
      Uint8Array
    ) {
      return serialized;
    }
  }

  throw new Error(
    WALLET_UNSUPPORTED_SIGNING_MESSAGE
  );
}

function bytesToTransaction(
  original: unknown,
  signedBytes: Uint8Array
): unknown {
  if (
    original instanceof
    Transaction
  ) {
    return Transaction.from(
      signedBytes
    );
  }

  if (
    original instanceof
    VersionedTransaction
  ) {
    return VersionedTransaction.deserialize(
      signedBytes
    );
  }

  if (
    typeof original ===
      'object' &&
    original !== null
  ) {
    return Object.assign(
      {},
      original,
      {
        serialize() {
          return signedBytes;
        },
      }
    );
  }

  return signedBytes;
}

function createWalletStandardProvider(
  wallet: WalletStandardWallet
): SolanaWalletProvider | null {
  const features =
    wallet.features as Record<
      string,
      unknown
    >;

  const connectFeature =
    features[
      'standard:connect'
    ] as
      | {
          connect: (input?: {
            silent?: boolean;
          }) => Promise<{
            accounts: Array<{
              address: string;
            }>;
          }>;
        }
      | undefined;

  const signTransactionFeature =
    features[
      'solana:signTransaction'
    ] as
      | {
          signTransaction: (input: {
            account: {
              address: string;
            };
            transaction: Uint8Array;
            chain: string;
          }) => Promise<
            Array<{
              signedTransaction: Uint8Array;
            }>
          >;
        }
      | undefined;

  const signAndSendFeature =
    features[
      'solana:signAndSendTransaction'
    ] as
      | {
          signAndSendTransaction: (input: {
            account: {
              address: string;
            };
            transaction: Uint8Array;
            chain: string;
          }) => Promise<
            Array<{
              signature: Uint8Array | string;
            }>
          >;
        }
      | undefined;

  const signMessageFeature =
    features[
      'solana:signMessage'
    ] as
      | {
          signMessage: (input: {
            account: {
              address: string;
            };
            message: Uint8Array;
          }) => Promise<
            Array<{
              signature: Uint8Array;
            }>
          >;
        }
      | undefined;

  if (
    !connectFeature ||
    (
      !signTransactionFeature &&
      !signAndSendFeature
    )
  ) {
    return null;
  }

  let activeAccount:
    | {
        address: string;
      }
    | undefined =
    wallet.accounts[0];

  const provider: SolanaWalletProvider =
    {
      async connect(
        options
      ) {
        const result =
          await connectFeature.connect(
            {
              silent:
                options?.onlyIfTrusted,
            }
          );

        activeAccount =
          result.accounts[0] ??
          wallet.accounts[0];

        if (
          !activeAccount
        ) {
          throw new Error(
            'No wallet account returned.'
          );
        }

        return {
          publicKey: {
            toString:
              () =>
                activeAccount!.address,
          },
        };
      },

      get publicKey() {
        const account =
          activeAccount ??
          wallet.accounts[0];

        if (
          !account
        ) {
          return undefined;
        }

        return {
          toString:
            () =>
              account.address,
        };
      },

      async signTransaction(
        transaction
      ) {
        if (
          !signTransactionFeature
        ) {
          throw new Error(
            WALLET_UNSUPPORTED_SIGNING_MESSAGE
          );
        }

        const account =
          activeAccount ??
          wallet.accounts[0];

        if (
          !account
        ) {
          throw new Error(
            'No wallet account selected.'
          );
        }

        const signed =
          await signTransactionFeature.signTransaction(
            {
              account,
              transaction:
                transactionToBytes(
                  transaction
                ),
              chain:
                walletChainId(),
            }
          );

        return bytesToTransaction(
          transaction,
          signed[0]!
            .signedTransaction
        );
      },

      async signAllTransactions(
        transactions
      ) {
        const signed =
          [];

        for (const transaction of transactions) {
          signed.push(
            await provider.signTransaction!(
              transaction
            )
          );
        }

        return signed;
      },

      async signAndSendTransaction(
        transaction
      ) {
        if (
          !signAndSendFeature
        ) {
          throw new Error(
            WALLET_UNSUPPORTED_SIGNING_MESSAGE
          );
        }

        const account =
          activeAccount ??
          wallet.accounts[0];

        if (
          !account
        ) {
          throw new Error(
            'No wallet account selected.'
          );
        }

        const result =
          await signAndSendFeature.signAndSendTransaction(
            {
              account,
              transaction:
                transactionToBytes(
                  transaction
                ),
              chain:
                walletChainId(),
            }
          );

        const signature =
          result[0]!.signature;

        return {
          signature:
            typeof signature ===
            'string'
              ? signature
              : Buffer.from(
                  signature
                ).toString(
                  'base64'
                ),
        };
      },

      async signMessage(
        message
      ) {
        if (
          !signMessageFeature
        ) {
          throw new Error(
            WALLET_UNSUPPORTED_SIGNING_MESSAGE
          );
        }

        let connectedAddress:
          | string
          | null =
          null;

        try {
          if (
            provider.publicKey
          ) {
            connectedAddress =
              normalizeWalletPublicKey(
                provider.publicKey
              );
          }
        } catch {
          connectedAddress =
            null;
        }

        let account =
          activeAccount ??
          wallet.accounts[0];

        if (
          connectedAddress
        ) {
          account =
            wallet.accounts.find(
              (
                entry
              ) =>
                entry.address ===
                connectedAddress
            ) ??
            account;
        }

        if (
          !account
        ) {
          throw new Error(
            'No wallet account selected.'
          );
        }

        const result =
          await signMessageFeature.signMessage(
            {
              account,
              message,
            }
          );

        return {
          signature:
            result[0]!
              .signature,
        };
      },
    };

  return normalizeProvider(
    provider
  );
}

function normalizeWalletBrand(
  wallet: DetectedWallet
): string {
  const name =
    wallet.name.toLowerCase();
  const id =
    wallet.id.toLowerCase();

  if (
    name.includes(
      'phantom'
    ) ||
    id.includes(
      'phantom'
    )
  ) {
    return 'phantom';
  }

  if (
    name.includes(
      'solflare'
    ) ||
    id.includes(
      'solflare'
    )
  ) {
    return 'solflare';
  }

  if (
    name.includes(
      'backpack'
    ) ||
    id.includes(
      'backpack'
    )
  ) {
    return 'backpack';
  }

  if (
    name.includes(
      'glow'
    ) ||
    id.includes(
      'glow'
    )
  ) {
    return 'glow';
  }

  if (
    name.includes(
      'metamask'
    ) ||
    id.includes(
      'metamask'
    )
  ) {
    return 'metamask';
  }

  return name.replace(
    /[^a-z0-9]+/g,
    '-'
  );
}

function walletSourcePriority(
  wallet: DetectedWallet
): number {
  if (
    wallet.source ===
    'wallet-standard'
  ) {
    return 0;
  }

  if (
    ALLOWED_INJECTED_WALLET_IDS.has(
      wallet.id
    )
  ) {
    return 1;
  }

  return 2;
}

function getStableWalletId(
  brand: string,
  wallet: DetectedWallet
): string {
  switch (brand) {
    case 'phantom':
      return 'phantom';
    case 'solflare':
      return 'solflare';
    case 'backpack':
      return 'backpack';
    case 'glow':
      return 'glow';
    case 'metamask':
      return 'metamask-solana';
    default:
      return wallet.id;
  }
}

function shouldReplaceWalletCandidate(
  existing: DetectedWallet,
  candidate: DetectedWallet
): boolean {
  const existingPriority =
    walletSourcePriority(
      existing
    );
  const candidatePriority =
    walletSourcePriority(
      candidate
    );

  if (
    candidatePriority <
    existingPriority
  ) {
    return true;
  }

  if (
    candidatePriority >
    existingPriority
  ) {
    return false;
  }

  return false;
}

function finalizeDetectedWallet(
  wallet: DetectedWallet,
  brand: string
): DetectedWallet {
  const walletId =
    getStableWalletId(
      brand,
      wallet
    );

  return {
    ...wallet,
    id: walletId,
    provider:
      enrichProviderSignMessage(
        adaptWalletProvider(
          wallet.provider
        ),
        walletId
      ),
  };
}

function registerWalletByBrand(
  wallet: DetectedWallet,
  brandMap: Map<
    string,
    DetectedWallet
  >
) {
  const brand =
    normalizeWalletBrand(
      wallet
    );
  const existing =
    brandMap.get(
      brand
    );

  if (
    !existing ||
    shouldReplaceWalletCandidate(
      existing,
      wallet
    )
  ) {
    brandMap.set(
      brand,
      finalizeDetectedWallet(
        wallet,
        brand
      )
    );
  }
}

function detectInjectedWallet(
  id: string,
  name: string,
  provider:
    | SolanaWalletProvider
    | undefined
): DetectedWallet | null {
  if (
    !ALLOWED_INJECTED_WALLET_IDS.has(
      id
    )
  ) {
    return null;
  }

  if (
    !provider ||
    !isAllowedInjectedSolanaWallet(
      provider
    )
  ) {
    return null;
  }

  return {
    id,
    name,
    provider:
      normalizeProvider(
        provider
      ),
    source:
      'injected',
  };
}

function detectWindowSolanaWallet(): DetectedWallet | null {
  const provider =
    window.solana;

  if (
    !provider ||
    !hasConnectMethod(
      provider
    )
  ) {
    return null;
  }

  if (
    provider.isPhantom
  ) {
    return detectInjectedWallet(
      'phantom',
      'Phantom',
      provider
    );
  }

  if (
    provider.isSolflare
  ) {
    return detectInjectedWallet(
      'solflare',
      'Solflare',
      provider
    );
  }

  if (
    provider.isBackpack
  ) {
    return detectInjectedWallet(
      'backpack',
      'Backpack',
      provider
    );
  }

  if (
    provider.isGlow
  ) {
    return detectInjectedWallet(
      'glow',
      'Glow',
      provider
    );
  }

  return null;
}

function getGlowProvider():
  | SolanaWalletProvider
  | undefined {
  const glow =
    window.glow;

  if (!glow) {
    return undefined;
  }

  if (
    typeof (
      glow as {
        solana?: SolanaWalletProvider;
      }
    ).solana !==
    'undefined'
  ) {
    return (
      glow as {
        solana?: SolanaWalletProvider;
      }
    ).solana;
  }

  return glow as SolanaWalletProvider;
}

function detectInjectedWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] =
    [];

  const candidates: Array<
    DetectedWallet | null
  > = [
    detectInjectedWallet(
      'phantom',
      'Phantom',
      window.phantom
        ?.solana
    ),
    detectInjectedWallet(
      'solflare',
      'Solflare',
      window.solflare
    ),
    detectInjectedWallet(
      'backpack',
      'Backpack',
      window.backpack
        ?.solana
    ),
    detectInjectedWallet(
      'glow',
      'Glow',
      getGlowProvider()
    ),
    detectWindowSolanaWallet(),
  ];

  for (const wallet of candidates) {
    if (wallet) {
      wallets.push(
        wallet
      );
    }
  }

  return wallets;
}

function detectWalletStandardProviders(): DetectedWallet[] {
  const wallets: DetectedWallet[] =
    [];

  for (const wallet of getWalletStandardWallets()) {
    if (
      !isSolanaWalletStandardWallet(
        wallet
      )
    ) {
      continue;
    }

    const provider =
      createWalletStandardProvider(
        wallet
      );

    if (
      !provider ||
      !hasSolanaSigningCapability(
        provider
      )
    ) {
      continue;
    }

    wallets.push({
      id:
        walletStandardWalletId(
          wallet
        ),
      name:
        wallet.name,
      provider,
      source:
        'wallet-standard',
    });
  }

  return wallets;
}

export function detectAvailableWallets(): DetectedWallet[] {
  providerRegistry.clear();

  const brandMap =
    new Map<
      string,
      DetectedWallet
    >();

  for (const wallet of detectInjectedWallets()) {
    registerWalletByBrand(
      wallet,
      brandMap
    );
  }

  for (const wallet of detectWalletStandardProviders()) {
    registerWalletByBrand(
      wallet,
      brandMap
    );
  }

  for (const wallet of brandMap.values()) {
    providerRegistry.set(
      wallet.id,
      wallet
    );
  }

  return Array.from(
    providerRegistry.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.name.localeCompare(
        b.name
      )
  );
}

export function getDetectedWallet(
  walletId: string
): DetectedWallet | undefined {
  if (
    providerRegistry.size ===
    0
  ) {
    detectAvailableWallets();
  }

  return providerRegistry.get(
    walletId
  );
}

export function getWalletProvider(
  walletId: string
): SolanaWalletProvider | undefined {
  return getDetectedWallet(
    walletId
  )?.provider;
}

export type WalletNetworkReportStatus =
  | 'match'
  | 'mismatch'
  | 'unknown';

export type WalletNetworkReport = {
  status: WalletNetworkReportStatus;
  appNetwork: SolanaNetwork;
  walletNetwork?: SolanaNetwork;
};

function parseSolanaChainId(
  chain: string
): SolanaNetwork | null {
  const normalized =
    chain
      .trim()
      .toLowerCase();

  if (
    normalized.includes(
      'devnet'
    ) ||
    normalized ===
      'solana:103'
  ) {
    return 'devnet';
  }

  if (
    normalized.includes(
      'mainnet'
    ) ||
    normalized.includes(
      'mainnet-beta'
    ) ||
    normalized ===
      'solana:101' ||
    normalized ===
      'solana:mainnet'
  ) {
    return 'mainnet';
  }

  return null;
}

function readNetworkFromProvider(
  provider: SolanaWalletProvider
): SolanaNetwork | null {
  const raw =
    provider as {
      network?: unknown;
      chain?: unknown;
      cluster?: unknown;
    };

  for (const value of [
    raw.network,
    raw.chain,
    raw.cluster,
  ]) {
    if (
      typeof value !==
      'string'
    ) {
      continue;
    }

    const parsed =
      parseSolanaChainId(
        value
      );

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function readNetworkFromWalletStandard(
  walletId: string,
  walletAddress?: string
): SolanaNetwork | null {
  const detected =
    getDetectedWallet(
      walletId
    );

  if (
    !detected
  ) {
    return null;
  }

  const detectedName =
    detected.name
      .trim()
      .toLowerCase();

  for (const wallet of getWalletStandardWallets()) {
    const walletName =
      wallet.name
        .trim()
        .toLowerCase();

    if (
      walletName !==
      detectedName
    ) {
      continue;
    }

    for (const account of wallet.accounts) {
      if (
        walletAddress &&
        account.address !==
          walletAddress
      ) {
        continue;
      }

      const chains =
        (
          account as {
            chains?: readonly string[];
          }
        ).chains;

      if (
        !chains ||
        chains.length ===
          0
      ) {
        continue;
      }

      let hasMainnet =
        false;
      let hasDevnet =
        false;

      for (const chain of chains) {
        const parsed =
          parseSolanaChainId(
            chain
          );

        if (
          parsed ===
          'mainnet'
        ) {
          hasMainnet =
            true;
        }

        if (
          parsed ===
          'devnet'
        ) {
          hasDevnet =
            true;
        }
      }

      if (
        hasMainnet &&
        !hasDevnet
      ) {
        return 'mainnet';
      }

      if (
        hasDevnet &&
        !hasMainnet
      ) {
        return 'devnet';
      }

      if (
        hasMainnet
      ) {
        return 'mainnet';
      }

      if (
        hasDevnet
      ) {
        return 'devnet';
      }
    }
  }

  return null;
}

export function getWalletNetworkReport(
  walletId: string,
  appNetwork: SolanaNetwork,
  provider?: SolanaWalletProvider,
  walletAddress?: string
): WalletNetworkReport {
  let walletNetwork:
    | SolanaNetwork
    | null = null;

  if (provider) {
    walletNetwork =
      readNetworkFromProvider(
        provider
      );
  }

  if (
    !walletNetwork
  ) {
    walletNetwork =
      readNetworkFromWalletStandard(
        walletId,
        walletAddress
      );
  }

  if (
    !walletNetwork
  ) {
    return {
      status:
        'unknown',
      appNetwork,
    };
  }

  if (
    walletNetwork ===
    appNetwork
  ) {
    return {
      status:
        'match',
      appNetwork,
      walletNetwork,
    };
  }

  return {
    status:
      'mismatch',
    appNetwork,
    walletNetwork,
  };
}

export function subscribeToWalletChanges(
  listener: () => void
): () => void {
  const walletsApi =
    getWallets();

  const unregisterRegister =
    walletsApi.on(
      'register',
      listener
    );

  const unregisterUnregister =
    walletsApi.on(
      'unregister',
      listener
    );

  return () => {
    if (
      typeof unregisterRegister ===
      'function'
    ) {
      unregisterRegister();
    }

    if (
      typeof unregisterUnregister ===
      'function'
    ) {
      unregisterUnregister();
    }
  };
}
