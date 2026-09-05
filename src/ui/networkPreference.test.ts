import { describe, expect, it } from 'vitest';

import {
  DEVELOPER_DEVNET_STORAGE_KEY,
  developerNetworkControlsEnabled,
  networkBadgeLabel,
  requestedDeveloperNetwork,
} from './networkPreference';

describe('normal-user network preference', () => {
  it('keeps Devnet hidden unless a developer mechanism is used', () => {
    expect(developerNetworkControlsEnabled('', { getItem: () => null })).toBe(false);
    expect(developerNetworkControlsEnabled('?foo=1', { getItem: () => null })).toBe(false);
    expect(requestedDeveloperNetwork('')).toBeNull();
    expect(networkBadgeLabel('mainnet')).toBe('Solana Mainnet');
  });

  it('enables Devnet only through developer query or storage', () => {
    expect(developerNetworkControlsEnabled('?network=devnet', { getItem: () => null })).toBe(
      true
    );
    expect(developerNetworkControlsEnabled('?devnet=1', { getItem: () => null })).toBe(true);
    expect(
      developerNetworkControlsEnabled('', {
        getItem: (key) => (key === DEVELOPER_DEVNET_STORAGE_KEY ? '1' : null),
      })
    ).toBe(true);
    expect(requestedDeveloperNetwork('?network=devnet')).toBe('devnet');
    expect(requestedDeveloperNetwork('?network=mainnet')).toBe('mainnet');
    expect(networkBadgeLabel('devnet')).toBe('Solana Devnet');
  });
});
