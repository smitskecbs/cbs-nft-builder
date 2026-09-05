import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  fillMissingArtworkFromMetadata,
  isLikelyImageUri,
  nextIpfsGatewaySrc,
  normalizeAssetUri,
  resetMetadataImageCache,
  resolveDasImageUri,
  resolveImageFromMetadataJson,
  resolveMetadataImageUri,
} from './assetUri';

afterEach(() => {
  resetMetadataImageCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('asset URI helpers', () => {
  it('accepts https DAS links.image values', () => {
    expect(
      resolveDasImageUri({
        links: { image: 'https://cdn.helius-rpc.com/pixel.png' },
      })
    ).toBe('https://cdn.helius-rpc.com/pixel.png');
    expect(normalizeAssetUri('https://cdn.helius-rpc.com/pixel.png')).toBe(
      'https://cdn.helius-rpc.com/pixel.png'
    );
  });

  it('accepts ipfs:// DAS links.image values and normalizes them to a public gateway', () => {
    expect(
      resolveDasImageUri({
        links: { image: 'ipfs://bafylegacy/art.png' },
      })
    ).toBe('ipfs://bafylegacy/art.png');
    expect(normalizeAssetUri('ipfs://bafylegacy/art.png')).toBe(
      'https://gateway.pinata.cloud/ipfs/bafylegacy/art.png'
    );
    expect(nextIpfsGatewaySrc('https://gateway.pinata.cloud/ipfs/bafylegacy/art.png')).toBe(
      'https://ipfs.io/ipfs/bafylegacy/art.png'
    );
    expect(nextIpfsGatewaySrc('https://ipfs.io/ipfs/bafylegacy/art.png')).toBeNull();
  });

  it('prefers files[].cdn_uri over files[].uri', () => {
    expect(
      resolveDasImageUri({
        files: [
          {
            uri: 'ipfs://bafyfile/art.png',
            cdn_uri: 'https://cdn.helius-rpc.com/art.png',
            mime: 'image/png',
          },
        ],
      })
    ).toBe('https://cdn.helius-rpc.com/art.png');
  });

  it('uses files[].uri when it is ipfs:// and no cdn_uri is present', () => {
    expect(
      resolveDasImageUri({
        files: [{ uri: 'ipfs://bafyfile/art.png', mime: 'image/png' }],
      })
    ).toBe('ipfs://bafyfile/art.png');
  });

  it('does not treat metadata JSON URLs as artwork', () => {
    expect(isLikelyImageUri('https://example.com/item.json')).toBe(false);
    expect(
      resolveDasImageUri({
        links: { image: 'https://example.com/item.json' },
        files: [{ uri: 'https://example.com/item.json', mime: 'application/json' }],
      })
    ).toBeNull();
    expect(normalizeAssetUri('https://arweave.net/metadata.json')).toBeNull();
  });

  it('preserves Arweave HTTPS image URLs', () => {
    expect(normalizeAssetUri('https://arweave.net/abc123')).toBe('https://arweave.net/abc123');
  });

  it('reads image and properties.files from off-chain metadata JSON', () => {
    expect(
      resolveImageFromMetadataJson({
        image: 'ipfs://bafymeta/art.png',
      })
    ).toBe('ipfs://bafymeta/art.png');
    expect(
      resolveImageFromMetadataJson({
        properties: {
          files: [{ uri: 'ipfs://bafyprops/art.png', type: 'image/png' }],
        },
      })
    ).toBe('ipfs://bafyprops/art.png');
    expect(resolveImageFromMetadataJson({ image: { uri: 'not-a-string' } })).toBeNull();
  });

  it('fetches json_uri only as a fallback and caches the result', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ image: 'ipfs://bafyfetch/art.png' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await resolveMetadataImageUri('https://example.com/legacy.json');
    const second = await resolveMetadataImageUri('https://example.com/legacy.json');

    expect(first).toBe('ipfs://bafyfetch/art.png');
    expect(second).toBe('ipfs://bafyfetch/art.png');
    expect(normalizeAssetUri(first)).toBe('https://gateway.pinata.cloud/ipfs/bafyfetch/art.png');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fail discovery when metadata fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    const items = await fillMissingArtworkFromMetadata([
      {
        imageUri: null,
        metadataUri: 'https://example.com/missing.json',
      },
    ]);

    expect(items).toEqual([
      {
        imageUri: null,
        metadataUri: 'https://example.com/missing.json',
      },
    ]);
  });

  it('skips metadata fetch when DAS already provided artwork', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const items = await fillMissingArtworkFromMetadata([
      {
        imageUri: 'https://example.com/pixel.png',
        metadataUri: 'https://example.com/recent.json',
      },
    ]);

    expect(items[0]?.imageUri).toBe('https://example.com/pixel.png');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not reference secret env or RPC runtime values', () => {
    const source = readFileSync(fileURLToPath(new URL('./assetUri.ts', import.meta.url)), 'utf8');
    expect(source).not.toContain('HELIUS');
    expect(source).not.toContain('PINATA_JWT');
    expect(source).not.toContain('VITE_');
    expect(source).not.toContain('getRpc');
    expect(source).not.toContain('process.env');
  });
});
