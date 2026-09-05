export type SolanaNetwork = 'devnet' | 'mainnet';

const DEVNET_RPC_FALLBACK = 'https://api.devnet.solana.com';

/** Browser-facing mainnet JSON-RPC path (proxied by api/rpc). */
export const MAINNET_RPC_PROXY_PATH = '/api/rpc';

function readEnvRpc(name: 'VITE_HELIUS_DEVNET_RPC'): string | undefined {
  const value = import.meta.env[name];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

const HELIUS_DEVNET_RPC =
  readEnvRpc('VITE_HELIUS_DEVNET_RPC') ?? DEVNET_RPC_FALLBACK;

export const MAINNET_RPC_NOT_CONFIGURED_MESSAGE =
  'Mainnet RPC is not configured.';

function resolveMainnetRpcUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${MAINNET_RPC_PROXY_PATH}`;
  }

  return MAINNET_RPC_PROXY_PATH;
}

export function isMainnetRpcConfigured(): boolean {
  return true;
}

export const ENABLE_MAINNET = true;

export function resolveRpcForNetwork(
  network: SolanaNetwork,
  endpoints: {
    devnetRpc: string;
    mainnetRpc?: string;
  }
): string {
  if (network === 'mainnet') {
    if (!endpoints.mainnetRpc) {
      throw new Error(MAINNET_RPC_NOT_CONFIGURED_MESSAGE);
    }

    return endpoints.mainnetRpc;
  }

  return endpoints.devnetRpc;
}

export function getRpc(network: SolanaNetwork): string {
  return resolveRpcForNetwork(network, {
    devnetRpc: HELIUS_DEVNET_RPC,
    mainnetRpc: resolveMainnetRpcUrl(),
  });
}

export const RPC_COMMITMENT = 'confirmed' as const;
