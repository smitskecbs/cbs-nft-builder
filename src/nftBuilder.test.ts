import { describe, expect, it, vi } from 'vitest';

import { buildNftMetadata, toIpfsUri, toPinataGatewayUrl } from './metadata/buildNftMetadata';
import { royaltyPercentToBasisPoints, parseRoyaltyPercent } from './validation/royalties';
import { normalizeAttributes } from './validation/attributes';
import { validateArtworkFile, isAllowedArtworkMimeType } from './validation/artwork';
import { validateUniqueNftForm } from './validation/nftForm';
import { MAX_UPLOAD_BYTES } from './metadata/nftLimits';
import { getExplorerNftUrl, getExplorerTxUrl } from './solana/explorer';
import { planUniqueNftMint, UNIQUE_NFT_AMOUNT, UNIQUE_NFT_TOKEN_STANDARD } from './solana/createNft';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { buildPinataUploadAuthMessage } from './upload/pinataAuth';
import { formatUmiTransactionSignature, tryFormatUmiTransactionSignature } from './solana/formatSignature';
import {
  MARKETPLACE_DISCLAIMER,
  MARKETPLACE_EXTERNAL_REL,
  NFT_MARKETPLACES,
  renderMarketplaceCardsMarkup,
  renderResultMarketplaceLinksMarkup,
} from './marketplaces';
import {
  MAINNET_RPC_NOT_CONFIGURED_MESSAGE,
  resolveRpcForNetwork,
} from './solana/config';
import { getNetworkStatusCopy } from './solana/networkStatus';
import {
  DONATION_WALLET_ADDRESS,
  DONATION_WALLET_SHORT,
  shortenDonationAddress,
} from './support/donation';
import { isWalletRequestCancelled, mapErrorToUserMessage } from './validation/errors';
import { renderMintResultMarkup } from './ui/mintResultView';
import {
  INDEXING_NOTICE,
  NFT_CREATED_HEADING,
  replayStoredMintDisplay,
  resolveMintOutcome,
  resultRetryCreatesAnotherNft,
} from './solana/mintResult';
import { CBS_TOOL_URLS } from './cbsTools';
import {
  NFT_BUILDER_BANNER_PATH,
  NFT_BUILDER_LOGO_PATH,
  SOLANA_LOGOMARK_PATH,
} from './branding';
import { renderAppMarkup } from './ui/renderApp';

describe('NFT metadata builder', () => {
  it('builds Metaplex-style NFT JSON with ipfs URIs', () => {
    const metadata = buildNftMetadata({
      name: 'Cedar',
      symbol: 'CDR',
      description: 'A unique tree.',
      imageIpfsUri: 'bafytestcid',
      imageMimeType: 'image/png',
      externalUrl: 'https://cbs-coin.com',
      attributes: [{ trait_type: 'Color', value: 'Green' }],
      creatorAddress: 'ManGofryUWC5VWk7t4ATP32qJtGVBBNoVi2AQ9HyR9J',
    });

    expect(metadata.image).toBe('ipfs://bafytestcid');
    expect(metadata.properties.category).toBe('image');
    expect(metadata.properties.files[0]).toEqual({
      uri: 'ipfs://bafytestcid',
      type: 'image/png',
    });
    expect(metadata.properties.creators).toEqual([
      {
        address: 'ManGofryUWC5VWk7t4ATP32qJtGVBBNoVi2AQ9HyR9J',
        share: 100,
      },
    ]);
    expect(metadata.attributes).toEqual([{ trait_type: 'Color', value: 'Green' }]);
    expect(metadata.external_url).toBe('https://cbs-coin.com');
  });

  it('converts CIDs to ipfs and gateway URLs', () => {
    expect(toIpfsUri('abc')).toBe('ipfs://abc');
    expect(toIpfsUri('ipfs://abc')).toBe('ipfs://abc');
    expect(toPinataGatewayUrl('abc')).toBe('https://gateway.pinata.cloud/ipfs/abc');
  });
});

describe('royalties', () => {
  it('maps percent to basis points', () => {
    expect(royaltyPercentToBasisPoints(0)).toBe(0);
    expect(royaltyPercentToBasisPoints(5)).toBe(500);
    expect(royaltyPercentToBasisPoints(12.5)).toBe(1250);
    expect(royaltyPercentToBasisPoints(100)).toBe(10000);
  });

  it('parses empty royalty as 0%', () => {
    expect(parseRoyaltyPercent('')).toEqual({
      ok: true,
      percent: 0,
      basisPoints: 0,
    });
  });

  it('rejects out-of-range royalty', () => {
    expect(parseRoyaltyPercent('101').ok).toBe(false);
  });
});

describe('attributes', () => {
  it('drops empty rows and keeps filled traits', () => {
    const result = normalizeAttributes([
      { trait_type: '', value: '' },
      { trait_type: 'Background', value: 'Blue' },
    ]);

    expect(result).toEqual({
      ok: true,
      attributes: [{ trait_type: 'Background', value: 'Blue' }],
    });
  });

  it('rejects half-filled attributes', () => {
    const result = normalizeAttributes([{ trait_type: 'Background', value: '' }]);
    expect(result.ok).toBe(false);
  });
});

describe('artwork validation', () => {
  it('accepts allowed MIME types', () => {
    expect(isAllowedArtworkMimeType('image/png')).toBe(true);
    expect(isAllowedArtworkMimeType('image/jpeg')).toBe(true);
    expect(validateArtworkFile({ type: 'image/webp', name: 'a.webp', size: 12 }).ok).toBe(true);
  });

  it('rejects invalid MIME and oversized files', () => {
    expect(validateArtworkFile({ type: 'image/svg+xml', name: 'a.svg', size: 12 }).ok).toBe(false);
    const oversized = validateArtworkFile({
      type: 'image/png',
      name: 'big.png',
      size: MAX_UPLOAD_BYTES + 1,
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.error).toMatch(/2 MB/);
    }
  });
});

describe('explorer URLs', () => {
  it('adds cluster for devnet and omits it on mainnet', () => {
    expect(getExplorerNftUrl('devnet', 'Mint111')).toBe(
      'https://solscan.io/token/Mint111?cluster=devnet'
    );
    expect(getExplorerTxUrl('mainnet', 'Sig111')).toBe('https://solscan.io/tx/Sig111');
  });
});

describe('NFT form validation', () => {
  const artwork = { type: 'image/png', name: 'art.png', size: 1200 };

  it('requires a name, wallet, and artwork', () => {
    expect(
      validateUniqueNftForm({
        name: '',
        symbol: 'A',
        description: '',
        externalUrl: '',
        royaltyPercent: '0',
        isMutable: true,
        creatorAddress: '',
        attributes: [],
        artwork,
      }).ok
    ).toBe(false);
  });

  it('maps the mutable checkbox and accepts a valid unique NFT form', () => {
    const result = validateUniqueNftForm({
      name: 'Cedar',
      symbol: 'CDR',
      description: 'Unique tree',
      externalUrl: '',
      royaltyPercent: '2.5',
      isMutable: false,
      creatorAddress: 'ManGofryUWC5VWk7t4ATP32qJtGVBBNoVi2AQ9HyR9J',
      attributes: [],
      artwork,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isMutable).toBe(false);
      expect(result.value.royaltyBasisPoints).toBe(250);
    }
  });
});

describe('unique NFT mint plan', () => {
  it('uses NonFungible and amount 1, never a fungible supply hack', () => {
    const plan = planUniqueNftMint({
      royaltyPercent: 5,
      creatorAddress: 'ManGofryUWC5VWk7t4ATP32qJtGVBBNoVi2AQ9HyR9J',
      isMutable: true,
    });

    expect(plan.tokenStandard).toBe('NonFungible');
    expect(plan.tokenStandardValue).toBe(TokenStandard.NonFungible);
    expect(plan.amount).toBe(UNIQUE_NFT_AMOUNT);
    expect(UNIQUE_NFT_TOKEN_STANDARD).toBe('NonFungible');
    expect(plan.sellerFeeBasisPoints).toBe(500);
    expect(plan.creatorShare).toBe(100);
  });

  it('does not call the mint helper during unit tests', async () => {
    const mintUniqueNft = vi.fn();
    expect(mintUniqueNft).not.toHaveBeenCalled();
  });
});

describe('Pinata auth message', () => {
  it('names CBS NFT Builder, not Token Builder', () => {
    const message = buildPinataUploadAuthMessage('DemoWallet111', 1_700_000_000);
    expect(message).toContain('App: CBS NFT Builder');
    expect(message).not.toContain('CBS Token Builder');
    expect(message).toContain('Expires at (unix): 1700000300');
  });
});

describe('signature formatting', () => {
  it('encodes bytes as base58', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(formatUmiTransactionSignature(bytes)).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(formatUmiTransactionSignature('alreadyEncoded')).toBe('alreadyEncoded');
  });
});

describe('NFT marketplaces', () => {
  it('uses official homepage URLs with safe external link attributes', () => {
    expect(NFT_MARKETPLACES.map((item) => item.url)).toEqual([
      'https://magiceden.io/',
      'https://www.tensor.trade/',
    ]);
    expect(NFT_MARKETPLACES.map((item) => item.description)).toEqual([
      'Solana NFT Marketplace',
      'Solana NFT Marketplace',
    ]);
    expect(NFT_MARKETPLACES.every((item) => item.logoPath === null)).toBe(true);
    expect(MARKETPLACE_EXTERNAL_REL).toBe('noopener noreferrer');
    expect(MARKETPLACE_DISCLAIMER.toLowerCase()).toContain('does not automatically list');
    expect(renderMarketplaceCardsMarkup()).toContain('Visit Magic Eden');
    expect(renderMarketplaceCardsMarkup()).toContain('Visit Tensor');
    expect(renderMarketplaceCardsMarkup()).toContain('target="_blank"');
    expect(renderMarketplaceCardsMarkup()).toContain('rel="noopener noreferrer"');
    expect(renderMarketplaceCardsMarkup()).not.toContain('/marketplaces/');
    expect(renderResultMarketplaceLinksMarkup()).not.toMatch(/item\/|nft\/Mint/);
  });
});

describe('RPC selection', () => {
  it('never uses a mainnet RPC when the selected network is devnet', () => {
    expect(
      resolveRpcForNetwork('devnet', {
        devnetRpc: 'https://devnet.example',
        mainnetRpc: 'https://mainnet.example',
      })
    ).toBe('https://devnet.example');
  });

  it('requires a mainnet RPC only for mainnet', () => {
    expect(() =>
      resolveRpcForNetwork('mainnet', { devnetRpc: 'https://devnet.example' })
    ).toThrow(MAINNET_RPC_NOT_CONFIGURED_MESSAGE);
  });

  it('keeps the public Devnet fallback path when no Helius Devnet env is supplied', () => {
    expect(
      resolveRpcForNetwork('devnet', {
        devnetRpc: 'https://api.devnet.solana.com',
      })
    ).toBe('https://api.devnet.solana.com');
  });
});

describe('network status copy', () => {
  it('labels Devnet as a test network', () => {
    const copy = getNetworkStatusCopy('devnet', false);
    expect(copy.label).toBe('Devnet');
    expect(copy.detail).toContain('not mainnet');
    expect(copy.tone).toBe('devnet');
  });

  it('warns when Mainnet is selected without RPC', () => {
    const copy = getNetworkStatusCopy('mainnet', false);
    expect(copy.tone).toBe('error');
    expect(copy.detail).toBe('Mainnet RPC is not configured.');
  });

  it('states real SOL fees when Mainnet RPC is configured', () => {
    const copy = getNetworkStatusCopy('mainnet', true);
    expect(copy.tone).toBe('mainnet');
    expect(copy.detail).toContain('Real SOL');
  });
});

describe('CBS branding and support config', () => {
  it('points to the existing Solana and NFT Builder public assets', () => {
    expect(SOLANA_LOGOMARK_PATH).toBe('/assets/solana-logomark.svg');
    expect(NFT_BUILDER_LOGO_PATH).toBe('/nft-builder-logo.png');
    expect(NFT_BUILDER_BANNER_PATH).toBe('/nft-builder-banner.png');
  });

  it('reuses CBS Tools hub, coin, and GitHub URLs', () => {
    expect(CBS_TOOL_URLS.toolsHub).toBe('https://tools.cbs-coin.com');
    expect(CBS_TOOL_URLS.cbsCoin).toBe('https://cbs-coin.com');
    expect(CBS_TOOL_URLS.github).toBe('https://github.com/smitskecbs');
  });

  it('shortens the Token Builder donation wallet the same way', () => {
    expect(DONATION_WALLET_SHORT).toBe('ManGofry...HyR9J');
    expect(shortenDonationAddress(DONATION_WALLET_ADDRESS)).toBe(
      DONATION_WALLET_SHORT
    );
  });
});

describe('home and app shell markup', () => {
  it('starts on home with Create NFT closed and header wallet controls', () => {
    const html = renderAppMarkup();

    expect(html).toContain('id="appShell" class="app-shell is-home"');
    expect(html).toContain('id="homeBrandButton"');
    expect(html).toContain('id="networkSelect"');
    expect(html).toContain('id="networkBadge"');
    expect(html).toContain('Solana Mainnet');
    expect(html).toContain('option value="mainnet" selected');
    expect(html).toContain('option value="devnet"');
    expect(html).toContain('id="developerNetworkControls" class="developer-network-controls" hidden');
    expect(html).not.toContain('option value="devnet" selected');
    expect(html).toContain('id="connectWallet"');
    expect(html).toContain('What do you want to create?');
    expect(html).toContain('Mint one standalone NFT');
    expect(html).toContain('id="nftForm" class="hero-card page-section token-form" hidden');
    expect(html).not.toContain('class="session-bar"');
    expect(html).not.toContain('class="asset-type-card is-active"');
  });

  it('groups Create NFT and Create next NFT forms without a wizard', () => {
    const html = renderAppMarkup();

    expect(html).toContain('form-group-artwork');
    expect(html).toContain('<legend>Details</legend>');
    expect(html).toContain('<legend>Traits (optional)</legend>');
    expect(html).toContain('Create this NFT');
    expect(html).toContain('Short label (optional)');
    expect(html).toContain('Website for this NFT (optional)');
    expect(html).toContain('Royalty % you earn on later sales');
    expect(html).toContain('Keep editable after mint');
    expect(html).toContain('0% royalty is fine');
    expect(html).toContain('id="nftSymbol"');
    expect(html).toContain('id="nftExternalUrl"');
    expect(html).toContain('id="nftRoyalty"');
    expect(html).toContain('id="nftMutable"');
    expect(html).toContain('class="primary-btn mint-action-btn"');
    expect(html).toContain('id="createCollectionItemButton" type="submit" class="primary-btn mint-action-btn"');
    expect(html).toContain('Mint this item');
    expect(html).toContain('id="collectionItemName"');
    expect(html).toContain('id="collectionItemRoyalty" type="hidden"');
    expect(html).toContain('id="collectionItemSymbol" type="hidden"');
    expect(html).toContain('id="collectionItemMutable"');
    expect(html).toContain('id="saveDraftButton"');
    expect(html).not.toContain('Review and create NFT');
    expect(html).not.toContain('Step 1');
    expect(html).not.toContain('wizard');
  });
});

describe('post-mint result', () => {
  const signatureBytes = new Uint8Array([1, 2, 3, 4]);
  const signatureText = formatUmiTransactionSignature(signatureBytes);

  it('shows NFT created when send succeeded and the mint public key is known', () => {
    const outcome = resolveMintOutcome({
      mintAddress: 'Mint111Mint111Mint111Mint111111111111111111',
      signature: signatureBytes,
      sendSucceeded: true,
      confirmSucceeded: true,
    });

    expect(outcome.status).toBe('success');
    if (outcome.status !== 'success') {
      return;
    }

    const html = renderMintResultMarkup({
      name: 'Cedar',
      mintAddress: outcome.mintAddress,
      signature: outcome.signature,
      networkLabel: 'Mainnet',
      metadataUri: 'ipfs://bafytest',
      tokenStandard: 'NonFungible',
      artworkPreviewUrl: null,
      showIndexingNotice: outcome.showIndexingNotice,
    });

    expect(html).toContain(NFT_CREATED_HEADING);
    expect(html).toContain(outcome.mintAddress);
    expect(html).toContain(outcome.signature);
    expect(html).not.toMatch(/Mint Unavailable/i);
  });

  it('still shows a successful mint when post-mint confirm/lookup is unavailable', () => {
    const outcome = resolveMintOutcome({
      mintAddress: 'Mint111Mint111Mint111Mint111111111111111111',
      signature: signatureBytes,
      sendSucceeded: true,
      confirmSucceeded: false,
    });

    expect(outcome.status).toBe('success');
    if (outcome.status !== 'success') {
      return;
    }

    expect(outcome.showIndexingNotice).toBe(true);

    const html = renderMintResultMarkup({
      name: 'Cedar',
      mintAddress: outcome.mintAddress,
      signature: outcome.signature,
      networkLabel: 'Mainnet',
      metadataUri: 'ipfs://bafytest',
      tokenStandard: 'NonFungible',
      artworkPreviewUrl: null,
      showIndexingNotice: true,
    });

    expect(html).toContain(NFT_CREATED_HEADING);
    expect(html).toContain(INDEXING_NOTICE);
    expect(html).not.toMatch(/Mint Unavailable/i);
  });

  it('keeps a failed send as a failure even if a mint signer already exists', () => {
    const outcome = resolveMintOutcome({
      mintAddress: 'Mint111Mint111Mint111Mint111111111111111111',
      signature: signatureBytes,
      sendSucceeded: false,
      confirmSucceeded: false,
    });

    expect(outcome.status).toBe('failed');
    expect(mapErrorToUserMessage(new Error('Mint Unavailable'))).not.toMatch(
      /Mint Unavailable/i
    );
  });

  it('explains a missing local upload server without claiming a mint after submit', () => {
    expect(
      mapErrorToUserMessage(
        new Error(
          'Artwork upload failed because the local upload service became unavailable. Please restart the NFT Builder and try again.'
        )
      )
    ).toBe(
      'Artwork upload failed because the local upload service became unavailable. Nothing was minted. Please restart the NFT Builder and try again.'
    );
    expect(
      mapErrorToUserMessage(
        new Error(
          'Artwork upload failed because the local upload service became unavailable. Please restart the NFT Builder and try again.'
        ),
        { mintTransactionSubmitted: true }
      )
    ).toBe(
      'Artwork upload failed because the local upload service became unavailable. Please restart the NFT Builder and try again.'
    );
    expect(mapErrorToUserMessage(new Error('Failed to fetch'))).toBe('Failed to fetch');
  });

  it('maps wallet rejection to cancelled without claiming success', () => {
    expect(isWalletRequestCancelled(new Error('User rejected the request'))).toBe(true);
    expect(mapErrorToUserMessage(new Error('User rejected the request'))).toBe(
      'Wallet request was cancelled.'
    );
    expect(isWalletRequestCancelled(new Error('simulation failed'))).toBe(false);
  });

  it('does not create another NFT when replaying a stored result', () => {
    const mintUniqueNft = vi.fn();
    const stored = {
      name: 'Cedar',
      mintAddress: 'Mint111Mint111Mint111Mint111111111111111111',
      signature: signatureText,
      networkLabel: 'Mainnet' as const,
      metadataUri: 'ipfs://bafytest',
      tokenStandard: 'NonFungible' as const,
      artworkPreviewUrl: null,
      showIndexingNotice: false,
    };

    expect(resultRetryCreatesAnotherNft()).toBe(false);
    expect(replayStoredMintDisplay(stored)).toEqual(stored);
    expect(mintUniqueNft).not.toHaveBeenCalled();
  });

  it('formats Backpack-style nested signature objects', () => {
    expect(tryFormatUmiTransactionSignature({ signature: signatureBytes })).toBe(
      signatureText
    );
    expect(tryFormatUmiTransactionSignature({ signature: signatureText })).toBe(
      signatureText
    );
  });
});

