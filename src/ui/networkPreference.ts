export const DEVELOPER_DEVNET_STORAGE_KEY = 'cbsNftBuilderAllowDevnet';

export function developerNetworkControlsEnabled(
  search: string = '',
  storage: Pick<Storage, 'getItem'> | null = null
): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if (params.get('network') === 'devnet' || params.get('devnet') === '1') {
    return true;
  }

  try {
    return storage?.getItem(DEVELOPER_DEVNET_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function requestedDeveloperNetwork(search: string = ''): 'devnet' | 'mainnet' | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const value = params.get('network');

  if (value === 'devnet' || value === 'mainnet') {
    return value;
  }

  return null;
}

export function networkBadgeLabel(network: 'devnet' | 'mainnet'): string {
  return network === 'mainnet' ? 'Solana Mainnet' : 'Solana Devnet';
}
