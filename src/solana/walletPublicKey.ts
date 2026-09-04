import {
  PublicKey,
} from '@solana/web3.js';

type WalletLike = {
  connect?: (
    options?: {
      onlyIfTrusted?: boolean;
    }
  ) => Promise<{
    publicKey: unknown;
  }>;

  disconnect?: () => Promise<void>;

  publicKey?: unknown;

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

export const WALLET_PUBLIC_KEY_READ_ERROR =
  'Wallet public key could not be read. Please reconnect your wallet.';

export function isWalletDebugEnabled(): boolean {
  return (
    new URLSearchParams(
      window.location.search
    ).get('debug') ===
    '1'
  );
}

export function logWalletDebug(
  message: string,
  data?: Record<
    string,
    unknown
  >
) {
  if (
    !isWalletDebugEnabled()
  ) {
    return;
  }

  console.log(
    '[wallet-debug]',
    message,
    data ?? {}
  );
}

function describeWalletPublicKeyInput(
  input: unknown
): string {
  if (
    input ===
      null ||
    input ===
      undefined
  ) {
    return 'undefined';
  }

  if (
    typeof input ===
    'string'
  ) {
    return 'string';
  }

  if (
    input instanceof
    PublicKey
  ) {
    return 'PublicKey';
  }

  if (
    input instanceof
    Uint8Array
  ) {
    return 'Uint8Array';
  }

  const constructorName =
    (
      input as {
        constructor?: {
          name?: string;
        };
      }
    ).constructor?.name;

  return (
    constructorName ??
    typeof input
  );
}

export function normalizeWalletPublicKey(
  input: unknown
): string {
  if (
    input ===
      null ||
    input ===
      undefined
  ) {
    throw new Error(
      WALLET_PUBLIC_KEY_READ_ERROR
    );
  }

  if (
    typeof input ===
    'string'
  ) {
    const trimmed =
      input.trim();

    if (
      trimmed.startsWith(
        '0x'
      )
    ) {
      throw new Error(
        WALLET_PUBLIC_KEY_READ_ERROR
      );
    }

    try {
      return new PublicKey(
        trimmed
      ).toBase58();
    } catch {
      throw new Error(
        WALLET_PUBLIC_KEY_READ_ERROR
      );
    }
  }

  if (
    input instanceof
    PublicKey
  ) {
    return input.toBase58();
  }

  if (
    input instanceof
    Uint8Array
  ) {
    try {
      return new PublicKey(
        input
      ).toBase58();
    } catch {
      throw new Error(
        WALLET_PUBLIC_KEY_READ_ERROR
      );
    }
  }

  const value =
    input as Record<
      string,
      unknown
    >;

  if (
    typeof value.toBase58 ===
    'function'
  ) {
    try {
      const base58 =
        value.toBase58();

      if (
        typeof base58 ===
        'string'
      ) {
        return new PublicKey(
          base58
        ).toBase58();
      }
    } catch {
      // fall through
    }
  }

  if (
    typeof value.address ===
      'string' &&
    value.address.trim()
  ) {
    return normalizeWalletPublicKey(
      value.address
    );
  }

  if (
    typeof value.toString ===
    'function'
  ) {
    try {
      const stringValue =
        value.toString();

      if (
        typeof stringValue ===
          'string' &&
        stringValue !==
          '[object Object]'
      ) {
        return normalizeWalletPublicKey(
          stringValue
        );
      }
    } catch {
      // fall through
    }
  }

  throw new Error(
    WALLET_PUBLIC_KEY_READ_ERROR
  );
}

export function toWalletPublicKey(
  input: unknown
): PublicKey {
  return new PublicKey(
    normalizeWalletPublicKey(
      input
    )
  );
}

export function readWalletPublicKey(
  provider: WalletLike
): string | null {
  if (
    !provider.publicKey
  ) {
    return null;
  }

  try {
    return normalizeWalletPublicKey(
      provider.publicKey
    );
  } catch {
    return null;
  }
}

export async function connectAndNormalizeWalletPublicKey(
  provider: WalletLike,
  options?: {
    onlyIfTrusted?: boolean;
  }
): Promise<string> {
  if (
    typeof provider.connect !==
    'function'
  ) {
    throw new Error(
      WALLET_PUBLIC_KEY_READ_ERROR
    );
  }

  const response =
    await provider.connect(
      options
    );

  return normalizeWalletPublicKey(
    response.publicKey
  );
}

export function adaptWalletProvider<
  T extends WalletLike
>(
  provider: T
): T {
  const adapted = {
      disconnect:
        provider.disconnect?.bind(
          provider
        ),

      signTransaction:
        provider.signTransaction?.bind(
          provider
        ),

      signAllTransactions:
        provider.signAllTransactions?.bind(
          provider
        ),

      signAndSendTransaction:
        provider.signAndSendTransaction?.bind(
          provider
        ),

      signMessage:
        provider.signMessage?.bind(
          provider
        ),

      async connect(
        options?: {
          onlyIfTrusted?: boolean;
        }
      ) {
        if (
          typeof provider.connect !==
          'function'
        ) {
          throw new Error(
            WALLET_PUBLIC_KEY_READ_ERROR
          );
        }

        const response =
          await provider.connect(
            options
          );

        const publicKey =
          toWalletPublicKey(
            response.publicKey
          );

        return {
          publicKey,
        };
      },

      get publicKey() {
        if (
          !provider.publicKey
        ) {
          return undefined;
        }

        try {
          return toWalletPublicKey(
            provider.publicKey
          );
        } catch {
          return undefined;
        }
      },
    };

  return adapted as T;
}

export function getWalletPublicKeyDebugInfo(
  provider: WalletLike
): {
  rawPublicKeyType: string;
  normalizedPublicKey:
    | string
    | null;
} {
  const rawPublicKeyType =
    describeWalletPublicKeyInput(
      provider.publicKey
    );

  let normalizedPublicKey:
    | string
    | null =
    null;

  try {
    if (
      provider.publicKey
    ) {
      normalizedPublicKey =
        normalizeWalletPublicKey(
          provider.publicKey
        );
    }
  } catch {
    normalizedPublicKey =
      null;
  }

  return {
    rawPublicKeyType,
    normalizedPublicKey,
  };
}
