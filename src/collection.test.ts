import { describe, expect, it, vi } from 'vitest';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';

import {
  AUTO_OPEN_LAST_COLLECTION,
  DEFAULT_COLLECTION_DESCRIPTION,
  DEFAULT_COLLECTION_ITEM_PREFIX,
  DEFAULT_COLLECTION_NAME,
  MAX_COLLECTION_ITEMS,
  SIZE_CAP_IS_ON_CHAIN,
} from './collection/constants';
import {
  buildCollectionItemName,
  canAddCollectionItem,
  canAllocateItemNumber,
  extractItemNumberFromName,
  formatCollectionItemNumber,
  itemPrefixFromCollectionName,
  nextAvailableItemNumber,
} from './collection/numbering';
import {
  assertCollectionNetworkMatch,
  planCollectionItem,
  planCollectionNft,
} from './collection/plan';
import { analyzeExistingNftForCollection } from './collection/existingItem';
import {
  findCachedCollection,
  findCachedCollectionOnOtherNetwork,
  loadLastOpenedCollectionMint,
  loadRecentCollections,
  saveLastOpenedCollectionMint,
  saveRecentCollections,
  upsertRecentCollection,
} from './collection/persistence';
import { resolveMintOutcome, resultRetryCreatesAnotherNft } from './solana/mintResult';
import { renderCollectionCreatedMarkup, renderCollectionItemResultMarkup } from './ui/collectionViews';
import { renderAppMarkup } from './ui/renderApp';

describe('collection NFT plan', () => {
  it('uses NonFungible and isCollection', () => {
    const plan = planCollectionNft({
      isMutable: true,
      royaltyPercent: 0,
      creatorAddress: 'Wallet111',
    });

    expect(plan.tokenStandard).toBe('NonFungible');
    expect(plan.tokenStandardValue).toBe(TokenStandard.NonFungible);
    expect(plan.isCollection).toBe(true);
    expect(plan.amount).toBe(1);
    expect(plan.plannedMaxItems).toBe(100);
    expect(plan.sizeCapIsOnChain).toBe(false);
    expect(SIZE_CAP_IS_ON_CHAIN).toBe(false);
  });
});

describe('collection size', () => {
  it('enforces planned capacity in CBS logic only and is not on-chain', () => {
    expect(MAX_COLLECTION_ITEMS).toBe(100);
    expect(SIZE_CAP_IS_ON_CHAIN).toBe(false);
    expect(canAddCollectionItem(99).ok).toBe(true);
    expect(canAddCollectionItem(100).ok).toBe(false);
    expect(canAddCollectionItem(100).ok === false && 'error' in canAddCollectionItem(100)).toBe(true);
    const blocked = canAddCollectionItem(100);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.toLowerCase()).toContain('planned');
      expect(blocked.error.toLowerCase()).not.toContain('hard cap');
    }
  });
});

describe('collection numbering', () => {
  it('formats #001 through #100 and blocks duplicates', () => {
    expect(formatCollectionItemNumber(1)).toBe('#001');
    expect(formatCollectionItemNumber(100)).toBe('#100');
    expect(nextAvailableItemNumber([1])).toBe(2);
    expect(buildCollectionItemName('ManGo Pixel', 2)).toBe('ManGo Pixel #002');
    expect(canAllocateItemNumber([1], 1).ok).toBe(false);
    expect(canAllocateItemNumber([1], 2).ok).toBe(true);
    expect(extractItemNumberFromName('ManGo Pixel #001')).toBe(1);
    expect(nextAvailableItemNumber(Array.from({ length: 100 }, (_, i) => i + 1))).toBeNull();
  });
});

describe('collection item plan', () => {
  it('sets an unverified collection reference and verifyCollectionV1', () => {
    const plan = planCollectionItem({
      collectionMint: 'CollectionMint111',
      itemNumber: 2,
      isMutable: true,
      currentItemCount: 1,
    });

    expect(plan.ok).toBe(true);
    expect(plan.collection).toEqual({
      key: 'CollectionMint111',
      verified: false,
    });
    expect(plan.verifyInstruction).toBe('verifyCollectionV1');
    expect(plan.tokenStandard).toBe('NonFungible');
  });
});

describe('collection network isolation', () => {
  it('rejects mixing devnet and mainnet collections', () => {
    expect(assertCollectionNetworkMatch('devnet', 'mainnet').ok).toBe(false);
    expect(assertCollectionNetworkMatch('mainnet', 'mainnet').ok).toBe(true);
  });
});

describe('existing NFT attach capability', () => {
  const collectionMint = 'CollectionMint111';
  const wallet = 'Wallet111';

  it('allows set + verify when the wallet is both authorities and metadata is mutable', () => {
    const plan = analyzeExistingNftForCollection({
      nft: {
        mint: 'Existing001',
        name: 'ManGo Pixel #001',
        tokenStandard: 'NonFungible',
        isMutable: true,
        updateAuthority: wallet,
        collectionKey: null,
        collectionVerified: false,
      },
      collectionMint,
      walletAddress: wallet,
      collectionUpdateAuthority: wallet,
    });

    expect(plan.canAttempt).toBe(true);
    expect(plan.needsSetCollection).toBe(true);
    expect(plan.needsVerify).toBe(true);
    expect(plan.instructions).toContain('verifyCollectionV1');
  });

  it('does not remint an NFT already verified in this collection', () => {
    const plan = analyzeExistingNftForCollection({
      nft: {
        mint: 'Existing001',
        name: 'ManGo Pixel #001',
        tokenStandard: 'NonFungible',
        isMutable: true,
        updateAuthority: wallet,
        collectionKey: collectionMint,
        collectionVerified: true,
      },
      collectionMint,
      walletAddress: wallet,
      collectionUpdateAuthority: wallet,
    });

    expect(plan.canAttempt).toBe(false);
    expect(plan.alreadyVerifiedHere).toBe(true);
  });
});

describe('collection persistence cache', () => {
  it('stores recent collections per network and does not mix networks', () => {
    const memory = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
    vi.stubGlobal('localStorage', localStorageMock);

    upsertRecentCollection('devnet', {
      mint: 'DevMint',
      network: 'devnet',
      name: 'Dev Collection',
      symbol: 'DEV',
      plannedMaxItems: 100,
      itemNamePrefix: 'Dev',
      digitCount: 3,
      startNumber: 1,
      commonDescription: '',
      commonExternalUrl: '',
      commonRoyaltyPercent: 0,
      commonAttributes: [],
      isMutableDefault: true,
      items: [],
    });
    upsertRecentCollection('mainnet', {
      mint: 'MainMint',
      network: 'mainnet',
      name: 'Main Collection',
      symbol: 'MAIN',
      plannedMaxItems: 100,
      itemNamePrefix: 'Main',
      digitCount: 3,
      startNumber: 1,
      commonDescription: '',
      commonExternalUrl: '',
      commonRoyaltyPercent: 0,
      commonAttributes: [],
      isMutableDefault: true,
      items: [],
    });

    expect(loadRecentCollections('devnet').map((item) => item.mint)).toEqual(['DevMint']);
    expect(loadRecentCollections('mainnet').map((item) => item.mint)).toEqual(['MainMint']);
    expect(findCachedCollection('devnet', 'MainMint')).toBeNull();
    expect(findCachedCollectionOnOtherNetwork('devnet', 'MainMint')?.network).toBe('mainnet');
    saveLastOpenedCollectionMint('mainnet', 'MainMint');
    expect(loadLastOpenedCollectionMint('mainnet')).toBe('MainMint');
    expect(loadLastOpenedCollectionMint('devnet')).toBeNull();
    saveRecentCollections('devnet', []);
    vi.unstubAllGlobals();
  });
});

describe('collection results and remint safety', () => {
  it('shows Collection created without marketplace listing claims', () => {
    const html = renderCollectionCreatedMarkup({
      name: 'ManGo Pixel Collection',
      mintAddress: 'ColMint111',
      signature: 'Sig111',
      network: 'mainnet',
      metadataUri: 'ipfs://bafy',
      artworkPreviewUrl: null,
      showIndexingNotice: false,
      plannedMaxItems: 100,
    });

    expect(html).toContain('Collection created');
    expect(html).toContain('ColMint111');
    expect(html).toContain('Open Collection Manager');
    expect(html).toContain('Prepared drafts');
    expect(html.toLowerCase()).not.toContain('magic eden listing');
  });

  it('shows Verified only when the item result says verified', () => {
    const html = renderCollectionItemResultMarkup({
      name: 'ManGo Pixel #002',
      mintAddress: 'ItemMint111',
      signature: 'Sig222',
      network: 'mainnet',
      metadataUri: 'ipfs://bafy',
      artworkPreviewUrl: null,
      collectionName: 'ManGo Pixel Collection',
      collectionVerified: true,
      itemNumberLabel: '#002',
      showIndexingNotice: true,
    });

    expect(html).toContain('NFT created');
    expect(html).toContain('Linked to this collection');
    expect(html).toContain('#002');
    expect(html).toContain('ManGo Pixel Collection');
  });

  it('treats successful send + delayed confirm as success without reminting', () => {
    const mintFn = vi.fn();
    const outcome = resolveMintOutcome({
      mintAddress: 'Mint111',
      signature: new Uint8Array([1, 2, 3, 4]),
      sendSucceeded: true,
      confirmSucceeded: false,
    });

    expect(outcome.status).toBe('success');
    expect(resultRetryCreatesAnotherNft()).toBe(false);
    expect(mintFn).not.toHaveBeenCalled();
  });
});

describe('builder primary navigation markup', () => {
  it('shows three beginner choices without a blocking education card or SFT workflow', () => {
    const html = renderAppMarkup();

    expect(html).toContain('data-asset-type="nft"');
    expect(html).toContain('data-asset-type="create-collection"');
    expect(html).toContain('data-asset-type="manage-collection"');
    expect(html).toContain('What do you want to create?');
    expect(html).toContain('Mint one standalone NFT');
    expect(html).toContain('Create one unique NFT.');
    expect(html).toContain('This creates the cover of your collection.');
    expect(html).toContain('Open another collection');
    expect(html).toContain('Collection address');
    expect(html).toContain('Your collections');
    expect(html).toContain('Connect your wallet to find collections you manage, or paste a collection address below.');
    expect(html).toContain('Open collection');
    expect(html).toContain('Solana Mainnet');
    expect(html).toContain('option value="mainnet" selected');
    expect(html).toContain('id="developerNetworkControls" class="developer-network-controls" hidden');
    expect(html).toContain('coming soon');
    expect(html).toContain('id="homeBrandButton"');
    expect(html).toContain('id="nftForm" class="hero-card page-section token-form" hidden');
    expect(html).toContain('id="collectionForm" class="hero-card page-section token-form" hidden');
    expect(html).toContain('id="recentCollectionsSection" class="hero-card page-section open-collection-card" hidden');
    expect(html).toContain('class="nft-gallery"');
    expect(html).toContain('Advanced details');
    expect(html).not.toContain('class="asset-type-card is-active"');
    expect(html).not.toContain('data-asset-type="sft"');
    expect(html).not.toContain('Metaplex Token Metadata');
    expect(html).not.toContain('value="ManGo Pixel Collection"');
    expect(html).not.toContain('value="MANGO"');
    expect(html).not.toContain('value="https://mangomeme.fun"');
    expect(html).not.toContain('value="ManGo Pixel"');
    expect(html).not.toContain('MANGO');
    expect(html).not.toContain('mangomeme.fun');
    expect(html).not.toContain('ManGo Pixel');
    expect(html).toContain('id="collectionSymbol"');
    expect(html).toContain('id="collectionExternalUrl"');
    expect(html).toContain('id="collectionItemBaseName"');
    expect(html).toContain('Derived from the collection name');
    expect(html).toContain('id="nftForm"');
    expect(html).toContain('id="collectionForm"');
    expect(html).toContain('id="recentCollectionsSection"');
    expect(html).toContain('id="yourCollectionsSection"');
    expect(html).toContain('id="openAnotherCollectionSection"');
    expect(html).toContain('id="recentCollectionsBlock" class="manage-block" hidden');
    expect(html).toContain('id="openCollectionMint" type="text" autocomplete="off" spellcheck="false"');
    expect(html).not.toContain('3M6W1vqH7c7gNdh7moLcN3HTcCffBn8ohVrx9aZFRGG2');
    expect(html).not.toMatch(/id="openCollectionMint"[^>]*value="/);
  });
});

describe('generic collection defaults', () => {
  it('does not use ManGo as a runtime collection default', () => {
    expect(DEFAULT_COLLECTION_NAME).toBe('');
    expect(DEFAULT_COLLECTION_DESCRIPTION).toBe('');
    expect(DEFAULT_COLLECTION_ITEM_PREFIX).toBe('');
    expect(AUTO_OPEN_LAST_COLLECTION).toBe(false);
  });
});

describe('generic collection item prefix', () => {
  it('derives a neutral item base name from the collection name', () => {
    expect(itemPrefixFromCollectionName('My Cats Collection')).toBe('My Cats');
    expect(itemPrefixFromCollectionName('ManGo Pixel Collection')).toBe('ManGo Pixel');
    expect(itemPrefixFromCollectionName('Space Apes')).toBe('Space Apes');
    expect(itemPrefixFromCollectionName('')).toBe('Item');
  });
});
