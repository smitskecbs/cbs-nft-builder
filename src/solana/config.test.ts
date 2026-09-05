import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAINNET_RPC_PROXY_PATH,
  getRpc,
  isMainnetRpcConfigured,
  resolveRpcForNetwork,
} from './config';

const DEVNET_FALLBACK = 'https://api.devnet.solana.com';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Mainnet RPC proxy selection', () => {
  it('resolves Mainnet to same-origin /api/rpc and never a Helius URL or API key', () => {
    const rpc = getRpc('mainnet');

    expect(rpc === MAINNET_RPC_PROXY_PATH || rpc.endsWith(MAINNET_RPC_PROXY_PATH)).toBe(
      true
    );
    expect(rpc.toLowerCase()).not.toContain('helius');
    expect(rpc.toLowerCase()).not.toContain('api-key');
    expect(rpc).not.toContain('VITE_HELIUS_MAINNET_RPC');
  });

  it('uses the browser origin for Mainnet when window.location.origin is available', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173' },
    });

    expect(getRpc('mainnet')).toBe('http://localhost:5173/api/rpc');
  });

  it('treats Mainnet as configured without VITE_HELIUS_MAINNET_RPC', () => {
    expect(isMainnetRpcConfigured()).toBe(true);
    expect(getRpc('mainnet')).toContain('/api/rpc');
  });
});

describe('Devnet RPC selection', () => {
  it('still resolves Devnet to the public fallback or optional VITE_HELIUS_DEVNET_RPC', () => {
    const expected =
      import.meta.env.VITE_HELIUS_DEVNET_RPC?.trim() || DEVNET_FALLBACK;

    expect(getRpc('devnet')).toBe(expected);
    expect(getRpc('devnet')).not.toContain(MAINNET_RPC_PROXY_PATH);
  });
});

describe('network isolation', () => {
  it('never uses a mainnet RPC when the selected network is devnet', () => {
    expect(
      resolveRpcForNetwork('devnet', {
        devnetRpc: 'https://devnet.example',
        mainnetRpc: 'https://mainnet.example',
      })
    ).toBe('https://devnet.example');
    expect(getRpc('devnet')).not.toBe(getRpc('mainnet'));
  });
});
