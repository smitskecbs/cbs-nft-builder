import { escapeHtml, shortAddress } from './html';
import { getExplorerNftUrl, getExplorerTxUrl } from '../solana/explorer';
import { INDEXING_NOTICE } from '../solana/mintResult';
import { PLANNED_SIZE_NOT_ON_CHAIN_NOTE } from '../collection/constants';
import type { CachedCollection } from '../collection/persistence';
import type { ExistingNftAttachPlan } from '../collection/existingItem';
import type { OnChainCollectionView } from '../solana/collectionOnChain';
import type { SolanaNetwork } from '../solana/config';
import { nextIpfsGatewaySrc, normalizeAssetUri } from '../solana/assetUri';
import type { StudioCapacityView } from '../studio/capacity';
import type { StudioDefaults, StudioDraft } from '../studio/types';
import { collectionItemStatusLabel, draftStatusLabel, isNumberLocked } from '../studio/types';
import type { StudioNumbering } from '../studio/numbering';
import { formatStudioItemNumber, previewStudioNames } from '../studio/numbering';
import { canMintStudioDraft } from '../studio/itemMint';
import type { ResolvedDraftMetadata } from '../studio/resolve';
import type { ManagerListItem } from '../studio/resume';
import { COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE } from '../solana/discoverCollectionItems';

export function renderCollectionPreviewMarkup(model: {
  name: string;
  symbol: string;
  description: string;
  externalUrl: string;
  royaltyPercent: number;
  royaltyBasisPoints: number;
  isMutable: boolean;
  creatorAddress: string;
  network: SolanaNetwork;
  artworkPreviewUrl: string | null;
  metadataUri?: string;
  plannedMaxItems: number;
  numberingPreview: string[];
}): string {
  const artwork = model.artworkPreviewUrl
    ? `<img class="image-preview" src="${escapeHtml(model.artworkPreviewUrl)}" alt="Collection artwork preview" />`
    : '';

  return `
    <h3>Preview</h3>
    ${artwork}
    <dl class="preview-list">
      <div><dt>What you are creating</dt><dd>Collection cover</dd></div>
      <div><dt>Network</dt><dd>${model.network === 'mainnet' ? 'Mainnet' : 'Devnet'}</dd></div>
      <div><dt>Name</dt><dd>${escapeHtml(model.name)}</dd></div>
      <div><dt>Description</dt><dd>${escapeHtml(model.description || '—')}</dd></div>
    </dl>
    <p class="helper-text">This creates the cover of your collection. You can add the individual NFTs afterwards.</p>
  `;
}

export function renderCollectionCreatedMarkup(model: {
  name: string;
  mintAddress: string;
  signature: string;
  network: SolanaNetwork;
  metadataUri: string;
  artworkPreviewUrl: string | null;
  showIndexingNotice: boolean;
  plannedMaxItems: number;
  preparedDraftCount?: number;
}): string {
  const nftUrl = getExplorerNftUrl(model.network, model.mintAddress);
  const txUrl = getExplorerTxUrl(model.network, model.signature);
  const artwork = model.artworkPreviewUrl
    ? `<img class="image-preview" src="${escapeHtml(model.artworkPreviewUrl)}" alt="${escapeHtml(model.name)} artwork" />`
    : '';

  return `
    <h2>Collection created</h2>
    ${model.showIndexingNotice ? `<p class="helper-text">${escapeHtml(INDEXING_NOTICE)}</p>` : ''}
    ${artwork}
    <dl class="preview-list">
      <div><dt>Collection name</dt><dd>${escapeHtml(model.name)}</dd></div>
      <div><dt>Collection address</dt><dd>${escapeHtml(model.mintAddress)}</dd></div>
      <div><dt>Transaction</dt><dd>${escapeHtml(model.signature)}</dd></div>
      <div><dt>Network</dt><dd>${model.network === 'mainnet' ? 'Mainnet' : 'Devnet'}</dd></div>
      <div><dt>Metadata URI</dt><dd>${escapeHtml(model.metadataUri)}</dd></div>
      <div><dt>Planned size</dt><dd>${model.plannedMaxItems} (local target)</dd></div>
      <div><dt>Prepared drafts</dt><dd>${model.preparedDraftCount ?? 0}</dd></div>
    </dl>
    <div class="result-actions">
      <button type="button" class="primary-btn" id="manageCreatedCollection">Open Collection Manager</button>
      <a class="secondary-btn" href="${escapeHtml(nftUrl)}" target="_blank" rel="noopener noreferrer">View collection mint on Solscan</a>
      <a class="secondary-btn" href="${escapeHtml(txUrl)}" target="_blank" rel="noopener noreferrer">View transaction on Solscan</a>
    </div>
    <p class="helper-text">Your prepared items are ready in Collection Manager. Creating a collection does not mint items or list it on a marketplace.</p>
  `;
}

export function renderCollectionItemResultMarkup(model: {
  name: string;
  mintAddress: string;
  signature: string;
  network: SolanaNetwork;
  metadataUri: string;
  artworkPreviewUrl: string | null;
  collectionName: string;
  collectionVerified: boolean;
  itemNumberLabel: string;
  showIndexingNotice: boolean;
}): string {
  const nftUrl = getExplorerNftUrl(model.network, model.mintAddress);
  const txUrl = getExplorerTxUrl(model.network, model.signature);
  const artwork = model.artworkPreviewUrl
    ? `<img class="image-preview" src="${escapeHtml(model.artworkPreviewUrl)}" alt="${escapeHtml(model.name)} artwork" />`
    : '';

  return `
    <h2>NFT created</h2>
    ${model.showIndexingNotice ? `<p class="helper-text">${escapeHtml(INDEXING_NOTICE)}</p>` : ''}
    ${artwork}
    <dl class="preview-list">
      <div><dt>Name</dt><dd>${escapeHtml(model.name)}</dd></div>
      <div><dt>Item</dt><dd>${escapeHtml(model.itemNumberLabel)}</dd></div>
      <div><dt>Mint</dt><dd>${escapeHtml(model.mintAddress)}</dd></div>
      <div><dt>Collection</dt><dd>${escapeHtml(model.collectionName)}</dd></div>
      <div><dt>Collection status</dt><dd>${model.collectionVerified ? 'Linked to this collection' : 'Not linked yet'}</dd></div>
      <div><dt>Network</dt><dd>${model.network === 'mainnet' ? 'Mainnet' : 'Devnet'}</dd></div>
      <div><dt>Metadata URI</dt><dd>${escapeHtml(model.metadataUri)}</dd></div>
      <div><dt>Transaction</dt><dd>${escapeHtml(model.signature)}</dd></div>
    </dl>
    <div class="result-actions">
      <a class="primary-btn" href="${escapeHtml(nftUrl)}" target="_blank" rel="noopener noreferrer">View NFT on Solscan</a>
      <a class="secondary-btn" href="${escapeHtml(txUrl)}" target="_blank" rel="noopener noreferrer">View transaction on Solscan</a>
      <button type="button" class="secondary-btn" id="backToCollectionManager">Back to Collection Manager</button>
    </div>
  `;
}

export function renderNumberingPreviewMarkup(numbering: StudioNumbering): string {
  const names = previewStudioNames(numbering);
  return `<p class="helper-text">Name preview: ${escapeHtml(names.join(' · '))}</p>`;
}

function compactMint(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

function looksLikeImageFileUrl(uri: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(uri.split('?')[0] ?? uri);
}

function toDisplayImageUrl(uri: string | null | undefined): string | null {
  return normalizeAssetUri(uri);
}

function discoveredArtworkMarkup(params: {
  imageUri: string | null | undefined;
  className: string;
  emptyClassName?: string;
  emptyLetter: string;
  alt: string;
}): string {
  const imageUrl = toDisplayImageUrl(params.imageUri);
  if (!imageUrl) {
    const emptyClass = params.emptyClassName
      ? `${params.className} ${params.emptyClassName}`
      : params.className;
    return `<div class="${emptyClass}" aria-hidden="true">${escapeHtml(params.emptyLetter)}</div>`;
  }

  const fallback = nextIpfsGatewaySrc(imageUrl);
  const fallbackAttr = fallback ? ` data-ipfs-fallback="${escapeHtml(fallback)}"` : '';
  return `<img class="${params.className}" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(params.alt)}"${fallbackAttr} />`;
}

export function handleDiscoveredArtworkError(img: HTMLImageElement): void {
  const next = img.getAttribute('data-ipfs-fallback');
  img.removeAttribute('data-ipfs-fallback');
  if (next && next !== img.getAttribute('src')) {
    img.src = next;
    return;
  }

  const name = img.getAttribute('alt') || '';
  const letter = (
    name.replace(/\s+artwork$/i, '').trim()[0]
    || (img.classList.contains('studio-cover') ? 'C' : '#')
  ).toUpperCase();
  const placeholder = document.createElement('div');
  placeholder.className = img.classList.contains('studio-cover')
    ? 'studio-cover'
    : 'nft-card-art nft-card-art-empty';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.textContent = letter;
  img.replaceWith(placeholder);
}

export function renderCollectionManagerMarkup(params: {
  cache: CachedCollection;
  onChain: OnChainCollectionView | null;
  capacity: StudioCapacityView;
  nextNumberLabel: string;
  preparedCount: number;
  mintedCount: number | null;
  verifiedCount: number | null;
  numberingBlocked?: boolean;
  discoveryError?: string | null;
}): string {
  const authority = params.onChain?.updateAuthority ?? 'Unknown until fetched';
  const network = params.cache.network === 'mainnet' ? 'Mainnet' : 'Devnet';
  const onChainName = params.onChain?.name || params.cache.name;
  const onChainMint = params.onChain?.mint || params.cache.mint;
  const numberingBlocked = params.numberingBlocked === true;
  const mintedLabel = params.mintedCount === null ? '—' : String(params.mintedCount);
  const verifiedLabel = params.verifiedCount === null ? '—' : String(params.verifiedCount);
  const nftCountLabel =
    params.mintedCount === 1 ? '1 NFT' : `${mintedLabel} NFTs`;
  const discoveryNote = numberingBlocked
    ? `<p class="warning-box">${escapeHtml(params.discoveryError || COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE)}</p>`
    : '';
  const addDisabled = numberingBlocked ? 'disabled' : '';
  const nextName =
    numberingBlocked || params.nextNumberLabel === 'disabled'
      ? 'Numbering paused'
      : params.nextNumberLabel.startsWith('#')
        ? `${params.cache.itemNamePrefix} ${params.nextNumberLabel}`
        : params.nextNumberLabel;
  const explorerUrl = getExplorerNftUrl(params.cache.network, onChainMint);
  const coverLetter = (onChainName.trim()[0] || 'C').toUpperCase();
  const coverUri = params.onChain?.uri ?? null;
  const coverMarkup = discoveredArtworkMarkup({
    imageUri: coverUri && looksLikeImageFileUrl(coverUri) ? coverUri : null,
    className: 'studio-cover',
    emptyLetter: coverLetter,
    alt: '',
  });

  return `
    <div class="studio-hero">
      ${coverMarkup}
      <div class="studio-hero-copy">
        <h2>${escapeHtml(onChainName)}</h2>
        <div class="studio-hero-meta">
          <span class="network-pill">${escapeHtml(network)}</span>
          <span>${escapeHtml(nftCountLabel)}</span>
          <span>${escapeHtml(verifiedLabel)} verified</span>
        </div>
        <div class="studio-mint-row">
          <code class="studio-mint">${escapeHtml(compactMint(onChainMint))}</code>
          <button type="button" class="ghost-btn" id="copyCollectionMint" data-collection-mint="${escapeHtml(onChainMint)}">Copy</button>
          <a class="ghost-btn" href="${escapeHtml(explorerUrl)}" target="_blank" rel="noopener noreferrer">Explorer</a>
        </div>
      </div>
      <button type="button" class="secondary-btn studio-close" id="closeCollectionManager">Close</button>
    </div>
    ${discoveryNote}
    <button type="button" class="nft-card nft-card-create" id="addNftDraftButton" ${addDisabled}>
      <span class="nft-card-create-plus" aria-hidden="true">+</span>
      <strong>Create next NFT</strong>
      <span>${escapeHtml(nextName)}</span>
    </button>
    <div class="studio-tech">
      <p class="helper-text">Collection created ✓</p>
      <div class="studio-stats" aria-label="Collection progress">
        <div class="studio-stat">
          <span class="studio-stat-label">Prepared</span>
          <strong>${params.preparedCount}</strong>
          <span>local drafts</span>
        </div>
        <div class="studio-stat">
          <span class="studio-stat-label">Minted</span>
          <strong>${mintedLabel}</strong>
          <span>item NFTs</span>
        </div>
        <div class="studio-stat">
          <span class="studio-stat-label">Verified in collection</span>
          <strong>${verifiedLabel}</strong>
          <span>linked items</span>
        </div>
        <div class="studio-stat">
          <span class="studio-stat-label">Planned capacity</span>
          <strong>${params.capacity.plannedCapacity}</strong>
          <span>CBS planned</span>
        </div>
      </div>
      <dl class="preview-list">
        <div><dt>On-chain name</dt><dd>${escapeHtml(onChainName)}</dd></div>
        <div><dt>Collection mint</dt><dd>${escapeHtml(onChainMint)}</dd></div>
        <div><dt>Network</dt><dd>${network}</dd></div>
        <div><dt>Can be updated by</dt><dd>${escapeHtml(shortAddress(authority))}</dd></div>
        <div><dt>Blockchain maximum</dt><dd>None. Planned size is a local target only.</dd></div>
      </dl>
      <p class="helper-text">${escapeHtml(PLANNED_SIZE_NOT_ON_CHAIN_NOTE)}</p>
      <p class="helper-text">Drafts are local. On-chain items stay on-chain.</p>
      <p class="helper-text">The collection cover is a separate NFT. Collection items are grouped by their collection relationship.</p>
    </div>
  `;
}

export function renderDraftListMarkup(
  drafts: readonly StudioDraft[],
  options: {
    collectionCreated?: boolean;
    digitCount?: number;
    artworkPreviewUrls?: ReadonlyMap<string, string>;
  } = {}
): string {
  if (drafts.length === 0) {
    return options.collectionCreated
      ? `<p class="helper-text">No prepared drafts yet. Use Create next NFT or import images. This does not create a new collection.</p>`
      : `<p class="helper-text">No prepared drafts yet. Import images to create drafts without minting.</p>`;
  }

  const collectionCreated = options.collectionCreated === true;
  const digitCount = options.digitCount ?? 3;
  const previews = options.artworkPreviewUrls;

  if (!collectionCreated) {
    return drafts
      .map((draft) => {
        const locked = isNumberLocked(draft.status);
        return `
        <article class="studio-draft-card${locked ? ' is-locked' : ''}" data-draft-id="${escapeHtml(draft.id)}" draggable="${locked ? 'false' : 'true'}">
          <div class="studio-draft-copy">
            <strong>${escapeHtml(draft.name)}</strong>
            <span>${escapeHtml(draftStatusLabel(draft.status))}</span>
            <span>${draft.artwork ? escapeHtml(draft.artwork.name) : 'No artwork yet'}</span>
          </div>
          <div class="studio-draft-actions">
            <button type="button" class="secondary-btn" data-draft-action="edit" data-draft-id="${escapeHtml(draft.id)}">Edit item</button>
            <button type="button" class="secondary-btn" data-draft-action="up" data-draft-id="${escapeHtml(draft.id)}" ${locked ? 'disabled' : ''}>Up</button>
            <button type="button" class="secondary-btn" data-draft-action="down" data-draft-id="${escapeHtml(draft.id)}" ${locked ? 'disabled' : ''}>Down</button>
            <button type="button" class="secondary-btn" data-draft-action="remove" data-draft-id="${escapeHtml(draft.id)}" ${locked ? 'disabled' : ''}>Remove</button>
          </div>
        </article>
      `;
      })
      .join('');
  }

  return `
    <h3>Items</h3>
    ${drafts
      .map((draft) => {
        const locked = isNumberLocked(draft.status);
        const numberLabel = formatStudioItemNumber(draft.number, digitCount);
        const preview = previews?.get(draft.id);
        const artwork = preview
          ? `<img class="studio-item-thumb" src="${escapeHtml(preview)}" alt="${escapeHtml(draft.name)} artwork" />`
          : `<div class="studio-item-thumb studio-item-thumb-empty" aria-hidden="true"></div>`;
        const minted = Boolean(draft.mintAddress);
        const verified = draft.status === 'collection_verified';
        const mintButton = canMintStudioDraft(draft)
          ? `<button type="button" class="primary-btn" data-draft-action="mint" data-draft-id="${escapeHtml(draft.id)}">Mint ${escapeHtml(numberLabel)}</button>`
          : '';
        const mintAddress = draft.mintAddress
          ? `<span>Mint address: ${escapeHtml(draft.mintAddress)}</span>`
          : '';
        const mintedMarks = minted
          ? `<span>Minted ✓</span>${verified ? '<span>Collection verified ✓</span>' : '<span>Collection verified pending</span>'}`
          : '';

        return `
        <article class="studio-draft-card studio-item-card${locked ? ' is-locked' : ''}" data-draft-id="${escapeHtml(draft.id)}">
          ${artwork}
          <div class="studio-draft-copy">
            <strong>${escapeHtml(numberLabel)} ${escapeHtml(draft.name)}</strong>
            <span>${escapeHtml(collectionItemStatusLabel(draft.status))}</span>
            ${mintedMarks}
            ${mintAddress}
            <span>${draft.artwork ? escapeHtml(draft.artwork.name) : 'No artwork yet. Add artwork before Mint.'}</span>
          </div>
          <div class="studio-draft-actions">
            <button type="button" class="secondary-btn" data-draft-action="edit" data-draft-id="${escapeHtml(draft.id)}">Edit</button>
            ${mintButton}
            <button type="button" class="secondary-btn" data-draft-action="up" data-draft-id="${escapeHtml(draft.id)}" ${locked ? 'disabled' : ''}>Up</button>
            <button type="button" class="secondary-btn" data-draft-action="down" data-draft-id="${escapeHtml(draft.id)}" ${locked ? 'disabled' : ''}>Down</button>
            <button type="button" class="secondary-btn" data-draft-action="remove" data-draft-id="${escapeHtml(draft.id)}" ${locked ? 'disabled' : ''}>Remove</button>
          </div>
        </article>
      `;
      })
      .join('')}
  `;
}

export function renderManagerItemListMarkup(
  items: readonly ManagerListItem[],
  options: {
    digitCount?: number;
    network?: SolanaNetwork;
    numberingBlocked?: boolean;
  } = {}
): string {
  if (items.length === 0) {
    return `<p class="helper-text nft-gallery-empty">No collection items found yet. Use Create next NFT or import images. This does not create a new collection.</p>`;
  }

  const digitCount = options.digitCount ?? 3;
  const network = options.network ?? 'devnet';
  const mintBlocked = options.numberingBlocked === true;

  return items
    .map((item) => {
      const numberLabel =
        item.number !== null ? formatStudioItemNumber(item.number, digitCount) : '';
      const artwork = discoveredArtworkMarkup({
        imageUri: item.imageUri,
        className: 'nft-card-art',
        emptyClassName: 'nft-card-art-empty',
        emptyLetter: (item.name.trim()[0] || '#').toUpperCase(),
        alt: `${item.name} artwork`,
      });
      const source = item.kind === 'on-chain' ? 'On-chain item' : 'Local draft';
      const minted = item.minted ? '<span class="nft-card-meta">Minted</span>' : '<span class="nft-card-meta">Prepared</span>';
      const verified =
        item.collectionVerified === true
          ? '<span class="nft-badge">Verified</span>'
          : item.collectionVerified === false
            ? '<span class="nft-card-meta">Not verified</span>'
            : item.minted
              ? '<span class="nft-card-meta">Verified status unknown</span>'
              : '';
      const explorer =
        item.mintAddress
          ? `<a class="ghost-btn nft-card-view" href="${escapeHtml(getExplorerNftUrl(network, item.mintAddress))}" target="_blank" rel="noopener noreferrer">View</a>`
          : '';
      const draft = item.draft;
      const canEdit = Boolean(draft && !isNumberLocked(draft.status) && item.kind === 'local-draft');
      const alreadyVerifiedMinted =
        item.minted && item.collectionVerified === true;
      const canMint = Boolean(
        draft && !mintBlocked && !alreadyVerifiedMinted && canMintStudioDraft(draft)
      );
      const mintButton =
        canMint && draft
          ? `<button type="button" class="primary-btn" data-draft-action="mint" data-draft-id="${escapeHtml(draft.id)}">Mint ${escapeHtml(numberLabel || draft.name)}</button>`
          : '';
      const editButton = canEdit && draft
        ? `<button type="button" class="secondary-btn" data-draft-action="edit" data-draft-id="${escapeHtml(draft.id)}">Edit</button>`
        : '';
      const reorder = canEdit && draft
        ? `<button type="button" class="secondary-btn" data-draft-action="up" data-draft-id="${escapeHtml(draft.id)}">Up</button>
            <button type="button" class="secondary-btn" data-draft-action="down" data-draft-id="${escapeHtml(draft.id)}">Down</button>
            <button type="button" class="secondary-btn" data-draft-action="remove" data-draft-id="${escapeHtml(draft.id)}">Remove</button>`
        : '';

      return `
        <article class="nft-card studio-draft-card studio-item-card${item.kind === 'on-chain' ? ' is-locked' : ''}" ${draft ? `data-draft-id="${escapeHtml(draft.id)}"` : ''}>
          ${artwork}
          <div class="nft-card-body studio-draft-copy">
            <strong>${escapeHtml(item.name)}</strong>
            ${verified}
            <span class="nft-card-meta">${source}</span>
            ${minted}
          </div>
          <div class="nft-card-actions studio-draft-actions">
            ${explorer}
            ${editButton}
            ${mintButton}
            ${reorder}
          </div>
        </article>
      `;
    })
    .join('');
}

export function fieldSourceLabel(isOverride: boolean): string {
  return isOverride ? 'Item override' : 'Collection Studio default';
}

export function renderStudioDefaultsMarkup(defaults: StudioDefaults, numberedName: string): string {
  const attributes =
    defaults.attributes.length === 0
      ? 'None'
      : defaults.attributes.map((item) => `${item.trait_type} = ${item.value}`).join(', ');

  return `
    <section class="item-editor-defaults">
      <h3>Collection Studio defaults</h3>
      <dl class="preview-list">
        <div><dt>Name</dt><dd>${escapeHtml(numberedName)}</dd></div>
        <div><dt>Description</dt><dd>${escapeHtml(defaults.description || '—')}</dd></div>
        <div><dt>External URL</dt><dd>${escapeHtml(defaults.externalUrl || '—')}</dd></div>
        <div><dt>Attributes</dt><dd>${escapeHtml(attributes)}</dd></div>
      </dl>
    </section>
  `;
}

export function renderResolvedItemPreviewMarkup(
  resolved: ResolvedDraftMetadata,
  artworkPreviewUrl: string | null
): string {
  const attributes =
    resolved.attributes.length === 0
      ? '<p class="preview-empty">No attributes</p>'
      : `<ul class="preview-attributes">${resolved.attributes
          .map(
            (attribute) =>
              `<li><strong>${escapeHtml(attribute.trait_type)}</strong> ${escapeHtml(attribute.value)}</li>`
          )
          .join('')}</ul>`;
  const artwork = artworkPreviewUrl
    ? `<img class="image-preview" src="${escapeHtml(artworkPreviewUrl)}" alt="${escapeHtml(resolved.name)} artwork" />`
    : resolved.artworkName
      ? `<p class="helper-text">Artwork: ${escapeHtml(resolved.artworkName)}</p>`
      : '<p class="helper-text">No artwork yet.</p>';

  return `
    <h3>Resolved metadata</h3>
    <p class="helper-text">This is what this NFT will use: Collection Studio defaults plus item overrides.</p>
    ${artwork}
    <dl class="preview-list">
      <div><dt>Name</dt><dd>${escapeHtml(resolved.name || '—')}</dd></div>
      <div><dt>Description</dt><dd class="item-editor-description-preview">${escapeHtml(resolved.description || '—')}</dd></div>
      <div><dt>Artwork</dt><dd>${escapeHtml(resolved.artworkName || '—')}</dd></div>
      <div><dt>External URL</dt><dd>${escapeHtml(resolved.externalUrl || '—')}</dd></div>
      <div><dt>Attributes</dt><dd>${attributes}</dd></div>
    </dl>
  `;
}

export function renderExistingNftPlanMarkup(plan: ExistingNftAttachPlan): string {
  if (plan.alreadyVerifiedHere) {
    return `<p class="helper-text">This NFT is already verified in this collection. Do not mint it again.</p>`;
  }

  if (!plan.canAttempt) {
    return `<p class="warning-box">${escapeHtml(plan.blockedReason ?? 'Cannot add this NFT.')}</p>`;
  }

  return `
    <p class="helper-text">This NFT can be added to the collection without minting a new one.</p>
  `;
}

export const YOUR_COLLECTIONS_WALLET_DISCONNECTED =
  'Connect your wallet to find collections you manage, or paste a collection address below.';

export const YOUR_COLLECTIONS_NONE_FOUND =
  'No collections found for this wallet.\nYou can still open a collection by address.';

export const YOUR_COLLECTIONS_LOAD_FAILED =
  'Could not load collections for this wallet. You can still open a collection by address.';

export type ManagedCollectionCard = {
  mint: string;
  name: string;
  imageUri: string | null;
  network: SolanaNetwork;
};

export function renderManagedCollectionsMarkup(collections: readonly ManagedCollectionCard[]): string {
  return collections
    .map((collection) => {
      const network = collection.network === 'mainnet' ? 'Mainnet' : 'Devnet';
      const artwork = discoveredArtworkMarkup({
        imageUri: collection.imageUri,
        className: 'nft-card-art',
        emptyClassName: 'nft-card-art-empty',
        emptyLetter: (collection.name.trim()[0] || 'C').toUpperCase(),
        alt: '',
      });

      return `
        <article class="nft-card managed-collection-card">
          ${artwork}
          <div class="nft-card-body">
            <strong>${escapeHtml(collection.name)}</strong>
            <code class="studio-mint">${escapeHtml(compactMint(collection.mint))}</code>
            <span class="network-pill">${escapeHtml(network)}</span>
          </div>
          <div class="nft-card-actions">
            <button type="button" class="primary-btn" data-collection-mint="${escapeHtml(collection.mint)}">
              Open collection
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

export function renderRecentCollectionsMarkup(collections: CachedCollection[]): string {
  if (collections.length === 0) {
    return '';
  }

  return collections
    .map((collection) => {
      const network = collection.network === 'mainnet' ? 'Mainnet' : 'Devnet';
      return `
        <button type="button" class="secondary-btn recent-collection-btn" data-collection-mint="${escapeHtml(collection.mint)}">
          ${escapeHtml(collection.name)} · ${network} · ${escapeHtml(collection.mint.slice(0, 4))}…${escapeHtml(collection.mint.slice(-4))}
        </button>
      `;
    })
    .join('');
}
