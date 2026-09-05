import './polyfills';
import './style.css';

import { renderAppMarkup } from './ui/renderApp';
import { requireElement } from './ui/dom';
import {
  developerNetworkControlsEnabled,
  networkBadgeLabel,
  requestedDeveloperNetwork,
} from './ui/networkPreference';
import { renderPreviewMarkup } from './ui/preview';
import { hideActionPopup, showActionPopup } from './ui/popup';
import { escapeHtml, shortAddress } from './ui/html';
import {
  MAINNET_RPC_NOT_CONFIGURED_MESSAGE,
  getRpc,
  isMainnetRpcConfigured,
  type SolanaNetwork,
} from './solana/config';
import { getNetworkStatusCopy } from './solana/networkStatus';
import { mintUniqueNft } from './solana/createNft';
import { createCollectionNft } from './solana/createCollectionNft';
import { createCollectionItemNft } from './solana/createCollectionItemNft';
import {
  addExistingNftToCollection,
  inspectExistingNftForCollection,
} from './solana/addExistingNftToCollection';
import {
  fetchCollectionOnChain,
  fetchExistingNftSnapshot,
  type OnChainCollectionView,
} from './solana/collectionOnChain';
import {
  DEFAULT_DIGIT_COUNT,
  DEFAULT_PLANNED_CAPACITY,
  DEFAULT_START_NUMBER,
} from './collection/constants';
import {
  buildCollectionItemName,
  canAllocateItemNumber,
  canAddCollectionItem,
  extractItemNumberFromName,
  itemPrefixFromCollectionName,
} from './collection/numbering';
import { assertCollectionNetworkMatch, planCollectionNft } from './collection/plan';
import {
  findCachedCollection,
  findCachedCollectionOnOtherNetwork,
  loadRecentCollections,
  recordCachedItem,
  saveLastOpenedCollectionMint,
  upsertRecentCollection,
  type CachedCollection,
} from './collection/persistence';
import {
  renderCollectionCreatedMarkup,
  renderCollectionItemResultMarkup,
  renderCollectionManagerMarkup,
  renderCollectionPreviewMarkup,
  renderDraftListMarkup,
  renderExistingNftPlanMarkup,
  renderManagerItemListMarkup,
  renderManagedCollectionsMarkup,
  renderNumberingPreviewMarkup,
  renderRecentCollectionsMarkup,
  renderResolvedItemPreviewMarkup,
  renderStudioDefaultsMarkup,
  fieldSourceLabel,
  handleDiscoveredArtworkError,
  YOUR_COLLECTIONS_LOAD_FAILED,
  YOUR_COLLECTIONS_NONE_FOUND,
  YOUR_COLLECTIONS_WALLET_DISCONNECTED,
} from './ui/collectionViews';
import {
  NFT_CREATED_HEADING,
  replayStoredMintDisplay,
  type MintDisplayModel,
} from './solana/mintResult';
import { renderMintResultMarkup } from './ui/mintResultView';
import {
  MIN_NFT_MINT_LAMPORTS,
  formatSol,
  getWalletLamports,
} from './solana/balance';
import {
  WALLET_UNSUPPORTED_SIGNING_MESSAGE,
  connectAndNormalizeWalletPublicKey,
  detectAvailableWallets,
  getWalletNetworkReport,
  setWalletNetworkResolver,
  subscribeToWalletChanges,
  walletSupportsTokenCreation,
  type SolanaWalletProvider,
} from './solana/wallets';
import { buildNftMetadata } from './metadata/buildNftMetadata';
import { validateUniqueNftForm } from './validation/nftForm';
import { normalizeAttributes } from './validation/attributes';
import { mapErrorToUserMessage } from './validation/errors';
import {
  requestPinataUploadAuthorization,
  uploadFileToPinata,
  uploadNftMetadataToPinata,
} from './upload/uploadToPinata';
import { copyDonationAddress } from './support/donation';
import { studioCapacityView } from './studio/capacity';
import { defaultStudioDefaults } from './studio/defaults';
import {
  applyDraftEditorValues,
  inheritedDraftName,
  resolveDraftMetadata,
} from './studio/resolve';
import {
  createStudioDraft,
  draftStatusAfterMintSend,
  importFilesAsDrafts,
  markDraftMintOutcome,
  removeDraft,
  reorderPreparedDrafts,
  updateDraftFields,
  usedNumbersFromDraftsAndMinted,
} from './studio/drafts';
import { classifyArtworkFiles, collectArtworkFiles } from './studio/importArtwork';
import {
  collectionStudioKey,
  getSharedStudioStore,
  type StudioStore,
} from './studio/persistence';
import {
  defaultStudioNumbering,
  formatStudioItemNumber,
  nextStudioItemNumber,
  previewStudioNames,
  validateStudioNumbering,
} from './studio/numbering';
import { defaultsFromCollection, numberingFromCollection } from './studio/session';
import { hasOnChainMintProof, isNumberLocked, type StudioDraft } from './studio/types';
import { attachDraftsToCollectionMint, draftsForOpenedCollection } from './studio/link';
import {
  assertMintTargetsDraft,
  prepareItemMintFromDraft,
  shouldMarkDraftFailedAfterMintError,
} from './studio/itemMint';
import {
  addItemDraftToExistingCollection,
  cachedCollectionFromSettings,
  cachedItemsFromDiscovered,
  collectionFromSnapshot,
  collectionProgress,
  emptyCollectionDiscovery,
  mergeManagerListItems,
  mintedNumbersFromRecords,
  nextNumberForExistingCollection,
  refuseCollectionOpenOnWrongNetwork,
  snapshotFromCollection,
  usedNumbersForContinue,
  wrongNetworkCollectionMessage,
} from './studio/resume';
import {
  applyCollectionStudioPane,
  collectionItemEditorHeading,
  type CollectionStudioPane,
} from './studio/itemEditorView';
import {
  COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
  discoverCollectionItems,
  type CollectionItemDiscovery,
} from './solana/discoverCollectionItems';
import { discoverManagedCollections } from './solana/discoverManagedCollections';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App element not found');
}

app.innerHTML = renderAppMarkup();

app.addEventListener(
  'error',
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    if (
      !target.classList.contains('nft-card-art')
      && !target.classList.contains('studio-cover')
    ) {
      return;
    }

    handleDiscoveredArtworkError(target);
  },
  true
);

const appShell = requireElement<HTMLDivElement>('#appShell');
const homeBrandButton = requireElement<HTMLButtonElement>('#homeBrandButton');
const networkSelect = requireElement<HTMLSelectElement>('#networkSelect');
const networkBadge = requireElement<HTMLSpanElement>('#networkBadge');
const developerNetworkControls = requireElement<HTMLDivElement>('#developerNetworkControls');
const walletSelect = requireElement<HTMLSelectElement>('#walletSelect');
const connectButton = requireElement<HTMLButtonElement>('#connectWallet');
const disconnectButton = requireElement<HTMLButtonElement>('#disconnectWallet');
const walletBox = requireElement<HTMLDivElement>('#walletBox');
const walletHint = requireElement<HTMLParagraphElement>('#walletDetectedHint');
const mainnetWarning = requireElement<HTMLDivElement>('#mainnetNetworkWarning');
const networkStatus = requireElement<HTMLDivElement>('#networkStatus');
const nftForm = requireElement<HTMLFormElement>('#nftForm');
const artworkInput = requireElement<HTMLInputElement>('#artworkInput');
const artworkPreview = requireElement<HTMLImageElement>('#artworkPreview');
const attributeRows = requireElement<HTMLDivElement>('#attributeRows');
const addAttributeButton = requireElement<HTMLButtonElement>('#addAttribute');
const previewPanel = requireElement<HTMLDivElement>('#nftPreview');
const statusBox = requireElement<HTMLDivElement>('#nftStatus');
const resultPanel = requireElement<HTMLDivElement>('#nftResult');
const mutableCheckbox = requireElement<HTMLInputElement>('#nftMutable');
const mutableHelp = requireElement<HTMLParagraphElement>('#mutableHelp');
const collectionForm = requireElement<HTMLFormElement>('#collectionForm');
const collectionArtworkInput = requireElement<HTMLInputElement>('#collectionArtworkInput');
const collectionArtworkPreview = requireElement<HTMLImageElement>('#collectionArtworkPreview');
const collectionPreview = requireElement<HTMLDivElement>('#collectionPreview');
const recentCollectionsSection = requireElement<HTMLElement>('#recentCollectionsSection');
const recentCollectionsBlock = requireElement<HTMLElement>('#recentCollectionsBlock');
const recentCollectionsList = requireElement<HTMLDivElement>('#recentCollectionsList');
const yourCollectionsStatus = requireElement<HTMLParagraphElement>('#yourCollectionsStatus');
const yourCollectionsList = requireElement<HTMLDivElement>('#yourCollectionsList');
const openCollectionMint = requireElement<HTMLInputElement>('#openCollectionMint');
const openCollectionButton = requireElement<HTMLButtonElement>('#openCollectionButton');
const collectionManager = requireElement<HTMLElement>('#collectionManager');
const collectionManagerSummary = requireElement<HTMLDivElement>('#collectionManagerSummary');
const studioGallery = requireElement<HTMLDivElement>('#studioGallery');
const collectionItemForm = requireElement<HTMLFormElement>('#collectionItemForm');
const collectionItemEditorTitle = requireElement<HTMLHeadingElement>('#collectionItemEditorTitle');
const backToCollectionButton = requireElement<HTMLButtonElement>('#backToCollectionButton');
const collectionItemArtworkInput = requireElement<HTMLInputElement>('#collectionItemArtworkInput');
const collectionItemArtworkPreview = requireElement<HTMLImageElement>('#collectionItemArtworkPreview');
const collectionNextNumber = requireElement<HTMLParagraphElement>('#collectionNextNumber');
const existingNftMint = requireElement<HTMLInputElement>('#existingNftMint');
const existingNftPlan = requireElement<HTMLDivElement>('#existingNftPlan');
const inspectExistingNftButton = requireElement<HTMLButtonElement>('#inspectExistingNftButton');
const addExistingNftButton = requireElement<HTMLButtonElement>('#addExistingNftButton');
const collectionNumberingPreview = requireElement<HTMLDivElement>('#collectionNumberingPreview');
const collectionDefaultAttributeRows = requireElement<HTMLDivElement>('#collectionDefaultAttributeRows');
const addCollectionDefaultAttributeButton = requireElement<HTMLButtonElement>('#addCollectionDefaultAttribute');
const pendingDraftDropzone = requireElement<HTMLDivElement>('#pendingDraftDropzone');
const pendingDraftArtworkInput = requireElement<HTMLInputElement>('#pendingDraftArtworkInput');
const pendingDraftFolderButton = requireElement<HTMLButtonElement>('#pendingDraftFolderButton');
const pendingDraftFolderInput = requireElement<HTMLInputElement>('#pendingDraftFolderInput');
const pendingDraftList = requireElement<HTMLDivElement>('#pendingDraftList');
const studioDraftDropzone = requireElement<HTMLDivElement>('#studioDraftDropzone');
const studioArtworkInput = requireElement<HTMLInputElement>('#studioArtworkInput');
const studioFolderButton = requireElement<HTMLButtonElement>('#studioFolderButton');
const studioFolderInput = requireElement<HTMLInputElement>('#studioFolderInput');
const studioImportStatus = requireElement<HTMLParagraphElement>('#studioImportStatus');
const studioDraftList = requireElement<HTMLDivElement>('#studioDraftList');
const studioAdvancedDetails = requireElement<HTMLDetailsElement>('#studioAdvancedDetails');
const editingDraftIdInput = requireElement<HTMLInputElement>('#editingDraftId');
const collectionItemAttributeRows = requireElement<HTMLDivElement>('#collectionItemAttributeRows');
const addCollectionItemAttributeButton = requireElement<HTMLButtonElement>('#addCollectionItemAttribute');
const saveDraftButton = requireElement<HTMLButtonElement>('#saveDraftButton');
const itemEditorOverlay = requireElement<HTMLDivElement>('#itemEditorOverlay');
const itemEditorTitle = requireElement<HTMLHeadingElement>('#itemEditorTitle');
const itemEditorDefaults = requireElement<HTMLDivElement>('#itemEditorDefaults');
const itemEditorArtworkPreview = requireElement<HTMLImageElement>('#itemEditorArtworkPreview');
const itemEditorArtworkName = requireElement<HTMLParagraphElement>('#itemEditorArtworkName');
const itemEditorName = requireElement<HTMLInputElement>('#itemEditorName');
const itemEditorDescription = requireElement<HTMLTextAreaElement>('#itemEditorDescription');
const itemEditorExternalUrl = requireElement<HTMLInputElement>('#itemEditorExternalUrl');
const itemEditorNameSource = requireElement<HTMLParagraphElement>('#itemEditorNameSource');
const itemEditorDescriptionSource = requireElement<HTMLParagraphElement>('#itemEditorDescriptionSource');
const itemEditorExternalUrlSource = requireElement<HTMLParagraphElement>('#itemEditorExternalUrlSource');
const itemEditorAttributesSource = requireElement<HTMLParagraphElement>('#itemEditorAttributesSource');
const itemEditorAttributeRows = requireElement<HTMLDivElement>('#itemEditorAttributeRows');
const itemEditorAddAttribute = requireElement<HTMLButtonElement>('#itemEditorAddAttribute');
const itemEditorPreview = requireElement<HTMLDivElement>('#itemEditorPreview');
const itemEditorSave = requireElement<HTMLButtonElement>('#itemEditorSave');
const itemEditorCancel = requireElement<HTMLButtonElement>('#itemEditorCancel');

let connectedWallet: SolanaWalletProvider | null = null;
let connectedWalletAddress = '';
let selectedWalletId = '';
let artworkObjectUrl: string | null = null;
let isBusy = false;
let lastMintDisplay: MintDisplayModel | null = null;
type BuilderMode = 'home' | 'nft' | 'create-collection' | 'manage-collection';

let builderMode: BuilderMode = 'home';
let managedDiscoverySeq = 0;
let collectionArtworkObjectUrl: string | null = null;
let collectionItemArtworkObjectUrl: string | null = null;
let activeCollection: CachedCollection | null = null;
let lastOnChainView: OnChainCollectionView | null = null;
let lastItemDiscovery: CollectionItemDiscovery | null = null;
let pendingExistingNftMint: string | null = null;
let studioStore: StudioStore = getSharedStudioStore();
let studioDrafts: StudioDraft[] = [];
let pendingDrafts: StudioDraft[] = [];
let selectedDraftId: string | null = null;
let collectionStudioPane: CollectionStudioPane = 'gallery';
let itemEditorDraftId: string | null = null;
let itemEditorPending = false;
let itemEditorArtworkUrl: string | null = null;
let studioDraftPreviewUrls = new Map<string, string>();

setWalletNetworkResolver(() => getSelectedNetwork());

function getSelectedNetwork(): SolanaNetwork {
  return networkSelect.value === 'devnet' ? 'devnet' : 'mainnet';
}

function applyDeveloperNetworkControls(): void {
  const search = window.location.search;
  const enabled = developerNetworkControlsEnabled(search, localStorage);
  developerNetworkControls.hidden = !enabled;

  const requested = requestedDeveloperNetwork(search);
  if (requested) {
    networkSelect.value = requested;
  } else if (!enabled) {
    networkSelect.value = 'mainnet';
  }
}

function updateNetworkBadge(): void {
  const network = getSelectedNetwork();
  networkBadge.textContent = networkBadgeLabel(network);
  networkBadge.dataset.tone = network;
}

function setStatus(message: string): void {
  statusBox.textContent = message;
}

function setError(message: string): void {
  statusBox.innerHTML = `<strong>Error</strong><br>${escapeHtml(message)}`;
}

function updateNetworkStatus(): void {
  const copy = getNetworkStatusCopy(
    getSelectedNetwork(),
    isMainnetRpcConfigured()
  );

  networkStatus.dataset.tone = copy.tone;
  networkStatus.innerHTML = `
    <span class="network-dot" aria-hidden="true"></span>
    <strong>${copy.label}</strong>
    <span>${copy.detail}</span>
  `;
  updateNetworkBadge();
}

function updateMainnetWarning(): void {
  if (getSelectedNetwork() === 'mainnet' && !isMainnetRpcConfigured()) {
    mainnetWarning.hidden = false;
    mainnetWarning.textContent = MAINNET_RPC_NOT_CONFIGURED_MESSAGE;
    return;
  }

  mainnetWarning.hidden = true;
  mainnetWarning.textContent = '';
}

function refreshWalletSelector(): void {
  const wallets = detectAvailableWallets();
  const previous = walletSelect.value || selectedWalletId;
  walletSelect.innerHTML = '';

  if (wallets.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No Solana wallet detected';
    walletSelect.append(option);
    walletHint.hidden = true;
    return;
  }

  for (const wallet of wallets) {
    const option = document.createElement('option');
    option.value = wallet.id;
    option.textContent = wallet.name;
    walletSelect.append(option);
  }

  walletSelect.value =
    wallets.some((wallet) => wallet.id === previous) ? previous : wallets[0].id;
  selectedWalletId = walletSelect.value;
  walletHint.hidden = false;
  walletHint.textContent = `${wallets.length} wallet${wallets.length === 1 ? '' : 's'} detected.`;
}

function updateWalletBox(): void {
  disconnectButton.hidden = !connectedWalletAddress;

  if (!connectedWalletAddress) {
    walletBox.textContent = 'No wallet connected';
    connectButton.textContent = 'Connect wallet';
    return;
  }

  walletBox.innerHTML = `
    <span class="wallet-connected-label">Connected</span>
    <code title="${escapeHtml(connectedWalletAddress)}">${escapeHtml(shortAddress(connectedWalletAddress))}</code>
  `;
  connectButton.textContent = 'Connected';
}

function clearWalletState(): void {
  connectedWallet = null;
  connectedWalletAddress = '';
  localStorage.removeItem('walletConnected');
  updateWalletBox();
}

async function connectSelectedWallet(onlyIfTrusted = false): Promise<void> {
  refreshWalletSelector();
  const walletId = walletSelect.value;
  const detected = detectAvailableWallets().find((wallet) => wallet.id === walletId);

  if (!detected) {
    throw new Error('No Solana wallet detected. Install Phantom, Solflare, Backpack, or Glow.');
  }

  selectedWalletId = detected.id;
  const address = await connectAndNormalizeWalletPublicKey(detected.provider, {
    onlyIfTrusted,
  });

  connectedWallet = detected.provider;
  connectedWalletAddress = address;
  localStorage.setItem('preferredWallet', selectedWalletId);
  localStorage.setItem('walletConnected', 'true');
  updateWalletBox();
}

async function disconnectWallet(): Promise<void> {
  try {
    await connectedWallet?.disconnect?.();
  } catch (error) {
    console.error(error);
  }

  clearWalletState();
}

function enableFolderInput(input: HTMLInputElement): void {
  input.setAttribute('webkitdirectory', '');
  input.setAttribute('directory', '');
}

enableFolderInput(pendingDraftFolderInput);
enableFolderInput(studioFolderInput);

function readAttributeInputsFrom(container: HTMLElement): Array<{ trait_type: string; value: string }> {
  return Array.from(container.querySelectorAll('.attribute-row')).map((row) => {
    const trait = row.querySelector<HTMLInputElement>('[data-attr="trait"]');
    const value = row.querySelector<HTMLInputElement>('[data-attr="value"]');
    return {
      trait_type: trait?.value ?? '',
      value: value?.value ?? '',
    };
  });
}

function addAttributeRowTo(
  container: HTMLElement,
  trait = '',
  value = '',
  onChange: () => void = () => undefined
): void {
  const row = document.createElement('div');
  row.className = 'attribute-row';
  row.innerHTML = `
    <label>
      Trait type
      <input data-attr="trait" type="text" maxlength="32" value="${escapeHtml(trait)}" />
    </label>
    <label>
      Value
      <input data-attr="value" type="text" maxlength="32" value="${escapeHtml(value)}" />
    </label>
    <button type="button" class="secondary-btn attribute-remove">Remove</button>
  `;
  row.querySelector('.attribute-remove')?.addEventListener('click', () => {
    row.remove();
    onChange();
  });
  row.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      onChange();
    });
  });
  container.append(row);
}

function replaceAttributeRows(
  container: HTMLElement,
  attributes: Array<{ trait_type: string; value: string }>,
  onChange: () => void = () => undefined
): void {
  container.innerHTML = '';
  for (const attribute of attributes) {
    addAttributeRowTo(container, attribute.trait_type, attribute.value, onChange);
  }
}

function assignFileToInput(input: HTMLInputElement, file: File): void {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function readStudioNumberingFromCreateForm() {
  const typedBaseName = requireElement<HTMLInputElement>('#collectionItemBaseName').value.trim();
  const collectionName = requireElement<HTMLInputElement>('#collectionName').value;
  return defaultStudioNumbering({
    baseName: typedBaseName || itemPrefixFromCollectionName(collectionName),
    digitCount: parsePositiveInt(
      requireElement<HTMLInputElement>('#collectionDigitCount').value,
      DEFAULT_DIGIT_COUNT
    ),
    start: parsePositiveInt(
      requireElement<HTMLInputElement>('#collectionStartNumber').value,
      DEFAULT_START_NUMBER
    ),
    plannedCapacity: parsePositiveInt(
      requireElement<HTMLInputElement>('#collectionPlannedCapacity').value,
      DEFAULT_PLANNED_CAPACITY
    ),
  });
}

function readStudioDefaultsFromCreateForm() {
  return defaultStudioDefaults({
    symbol: requireElement<HTMLInputElement>('#collectionSymbol').value,
    description: requireElement<HTMLTextAreaElement>('#collectionDescription').value,
    externalUrl: requireElement<HTMLInputElement>('#collectionExternalUrl').value,
    royaltyPercent: Number(requireElement<HTMLInputElement>('#collectionRoyalty').value) || 0,
    isMutable: requireElement<HTMLInputElement>('#collectionMutable').checked,
    attributes: readAttributeInputsFrom(collectionDefaultAttributeRows).filter(
      (item) => item.trait_type.trim() && item.value.trim()
    ),
  });
}

function pendingCollectionKey(): string {
  return collectionStudioKey(getSelectedNetwork(), null);
}

function activeCollectionKey(): string | null {
  if (!activeCollection) {
    return null;
  }

  return collectionStudioKey(activeCollection.network, activeCollection.mint);
}

async function persistDraft(draft: StudioDraft, blob?: Blob | null): Promise<void> {
  await studioStore.putDraft(draft);
  if (blob) {
    await studioStore.putBlob(draft.id, blob);
  }
}

async function persistDraftList(drafts: StudioDraft[]): Promise<void> {
  await Promise.all(drafts.map((draft) => studioStore.putDraft(draft)));
}

function revokeStudioPreviewUrls(): void {
  for (const url of studioDraftPreviewUrls.values()) {
    URL.revokeObjectURL(url);
  }
  studioDraftPreviewUrls = new Map();
}

async function loadStudioPreviewUrls(drafts: StudioDraft[]): Promise<void> {
  revokeStudioPreviewUrls();
  const next = new Map<string, string>();

  for (const draft of drafts) {
    const blob = await studioStore.getBlob(draft.id);
    if (blob) {
      next.set(draft.id, URL.createObjectURL(blob));
    }
  }

  studioDraftPreviewUrls = next;
}

async function persistLinkedDrafts(drafts: StudioDraft[]): Promise<void> {
  await persistDraftList(drafts);
}

async function persistStudioSnapshot(): Promise<void> {
  if (!activeCollection) {
    return;
  }

  await studioStore.putSettings(
    snapshotFromCollection(
      activeCollection,
      numberingFromCollection(activeCollection),
      defaultsFromCollection(activeCollection)
    )
  );
}

function rememberOpenedCollection(collection: CachedCollection): void {
  saveLastOpenedCollectionMint(collection.network, collection.mint);
}

function syncCollectionStudioPane(itemName?: string): void {
  applyCollectionStudioPane({
    pane: collectionStudioPane,
    gallery: studioGallery,
    editor: collectionItemForm,
    extras: studioAdvancedDetails,
  });
  collectionManager.classList.toggle('is-editing-item', collectionStudioPane === 'item-editor');

  if (collectionStudioPane !== 'item-editor') {
    return;
  }

  const name =
    itemName?.trim() ||
    requireElement<HTMLInputElement>('#collectionItemName').value.trim() ||
    'next NFT';
  collectionItemEditorTitle.textContent = collectionItemEditorHeading(name);
}

function revealCollectionItemEditor(itemName: string): void {
  collectionStudioPane = 'item-editor';
  syncCollectionStudioPane(itemName);
  collectionItemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  collectionItemEditorTitle.focus({ preventScroll: true });
  collectionItemArtworkInput.focus({ preventScroll: true });
}

function returnToCollectionGallery(): void {
  collectionStudioPane = 'gallery';
  syncCollectionStudioPane();
  studioGallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setStatus('Back to collection. Local drafts stay saved. Nothing was uploaded or minted.');
}

function bindCollectionManagerActions(): void {
  requireElement<HTMLButtonElement>('#addNftDraftButton').addEventListener('click', () => {
    void addNftDraftToActiveCollection();
  });
  requireElement<HTMLButtonElement>('#closeCollectionManager').addEventListener('click', () => {
    closeOpenedCollection();
  });
  document.querySelector<HTMLButtonElement>('#copyCollectionMint')?.addEventListener('click', () => {
    void copyCollectionMint();
  });
}

async function copyCollectionMint(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('#copyCollectionMint');
  const mint = button?.dataset.collectionMint?.trim();
  if (!mint) {
    return;
  }

  try {
    await navigator.clipboard.writeText(mint);
    setStatus('Collection address copied.');
  } catch {
    setStatus('Collection address is ready to copy from the collection header.');
  }
}

function closeOpenedCollection(): void {
  activeCollection = null;
  lastOnChainView = null;
  lastItemDiscovery = null;
  studioDrafts = [];
  selectedDraftId = null;
  collectionStudioPane = 'gallery';
  editingDraftIdInput.value = '';
  collectionManager.hidden = true;
  syncCollectionStudioPane();
  applyBuilderVisibility();
  refreshRecentCollections();
  setStatus('Collection closed. Local drafts stay saved. No transaction was sent.');
  void refreshYourCollections();
}

async function adoptDraftsForActiveCollection(): Promise<void> {
  if (!activeCollection) {
    return;
  }

  const network = activeCollection.network;
  const mint = activeCollection.mint;
  const collectionDrafts = await studioStore.getDrafts(collectionStudioKey(network, mint));
  const pending = await studioStore.getDrafts(collectionStudioKey(network, null));
  const result = draftsForOpenedCollection({
    collectionDrafts,
    pendingDrafts: pending,
    collectionMint: mint,
    network,
  });

  if (result.newlyLinked.length > 0) {
    await persistLinkedDrafts(result.newlyLinked);
  }
}

async function showCollectionManager(options: { fetchOnChain: boolean }): Promise<void> {
  if (!activeCollection) {
    return;
  }

  setBuilderModeKeepManager();
  applyBuilderVisibility();
  await adoptDraftsForActiveCollection();

  if (options.fetchOnChain) {
    await refreshActiveCollectionFromChain();
  } else {
    await renderCollectionManager();
  }

  collectionManager.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function syncBuilderNav(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-asset-type]').forEach((button) => {
    const isActive = button.dataset.assetType === builderMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function applyBuilderVisibility(): void {
  appShell.classList.toggle('is-home', builderMode === 'home');
  nftForm.hidden = builderMode !== 'nft';
  collectionForm.hidden = builderMode !== 'create-collection';
  if (builderMode === 'manage-collection') {
    const hasOpenCollection = Boolean(activeCollection);
    recentCollectionsSection.hidden = hasOpenCollection;
    collectionManager.hidden = !hasOpenCollection;
  } else {
    recentCollectionsSection.hidden = true;
    collectionManager.hidden = true;
  }
}

function setBuilderModeKeepManager(): void {
  builderMode = 'manage-collection';
  syncBuilderNav();
}

function editorStudioContext(pending: boolean): {
  drafts: StudioDraft[];
  defaults: ReturnType<typeof defaultStudioDefaults>;
  numbering: ReturnType<typeof defaultStudioNumbering>;
} {
  if (pending || !activeCollection) {
    return {
      drafts: pendingDrafts,
      defaults: readStudioDefaultsFromCreateForm(),
      numbering: readStudioNumberingFromCreateForm(),
    };
  }

  return {
    drafts: studioDrafts,
    defaults: defaultsFromCollection(activeCollection),
    numbering: numberingFromCollection(activeCollection),
  };
}

function readItemEditorValues() {
  return {
    name: itemEditorName.value,
    description: itemEditorDescription.value,
    externalUrl: itemEditorExternalUrl.value,
    attributes: readAttributeInputsFrom(itemEditorAttributeRows).filter(
      (item) => item.trait_type.trim() || item.value.trim()
    ),
  };
}

function refreshItemEditorPreview(): void {
  if (!itemEditorDraftId) {
    return;
  }

  const context = editorStudioContext(itemEditorPending);
  const draft = context.drafts.find((item) => item.id === itemEditorDraftId);

  if (!draft) {
    return;
  }

  const edited = applyDraftEditorValues(draft, context.defaults, context.numbering, readItemEditorValues());
  const resolved = resolveDraftMetadata(edited, context.defaults, context.numbering);
  itemEditorNameSource.textContent = fieldSourceLabel(resolved.nameIsOverride);
  itemEditorDescriptionSource.textContent = fieldSourceLabel(resolved.descriptionIsOverride);
  itemEditorExternalUrlSource.textContent = fieldSourceLabel(resolved.externalUrlIsOverride);
  itemEditorAttributesSource.textContent = fieldSourceLabel(resolved.attributesAreOverride);
  itemEditorPreview.innerHTML = renderResolvedItemPreviewMarkup(resolved, itemEditorArtworkUrl);
}

function closeItemEditor(): void {
  itemEditorOverlay.hidden = true;
  itemEditorDraftId = null;
  itemEditorPending = false;
  itemEditorSave.disabled = false;

  if (itemEditorArtworkUrl) {
    URL.revokeObjectURL(itemEditorArtworkUrl);
    itemEditorArtworkUrl = null;
  }

  itemEditorArtworkPreview.hidden = true;
  itemEditorArtworkPreview.removeAttribute('src');
}

async function openItemEditor(draftId: string, pending: boolean): Promise<void> {
  const context = editorStudioContext(pending);
  const draft = context.drafts.find((item) => item.id === draftId);

  if (!draft) {
    setError('Draft was not found.');
    return;
  }

  itemEditorDraftId = draft.id;
  itemEditorPending = pending;
  itemEditorTitle.textContent = `Edit item · ${draft.name}`;
  itemEditorDefaults.innerHTML = renderStudioDefaultsMarkup(
    context.defaults,
    inheritedDraftName(draft, context.numbering)
  );
  itemEditorSave.disabled = isNumberLocked(draft.status);

  if (itemEditorArtworkUrl) {
    URL.revokeObjectURL(itemEditorArtworkUrl);
    itemEditorArtworkUrl = null;
  }

  const blob = await studioStore.getBlob(draft.id);

  if (blob) {
    itemEditorArtworkUrl = URL.createObjectURL(blob);
    itemEditorArtworkPreview.src = itemEditorArtworkUrl;
    itemEditorArtworkPreview.hidden = false;
    itemEditorArtworkName.textContent = draft.artwork?.name
      ? `Artwork: ${draft.artwork.name}`
      : 'Artwork preview';
  } else {
    itemEditorArtworkPreview.hidden = true;
    itemEditorArtworkPreview.removeAttribute('src');
    itemEditorArtworkName.textContent = draft.artwork?.name
      ? `Artwork: ${draft.artwork.name}`
      : 'No artwork yet.';
  }

  const resolved = resolveDraftMetadata(draft, context.defaults, context.numbering);
  itemEditorName.value = resolved.name;
  itemEditorDescription.value = resolved.description;
  itemEditorExternalUrl.value = resolved.externalUrl;
  replaceAttributeRows(itemEditorAttributeRows, resolved.attributes, refreshItemEditorPreview);
  refreshItemEditorPreview();
  itemEditorOverlay.hidden = false;
  itemEditorName.focus();
}

async function saveItemEditor(): Promise<void> {
  if (!itemEditorDraftId) {
    return;
  }

  const context = editorStudioContext(itemEditorPending);
  const draft = context.drafts.find((item) => item.id === itemEditorDraftId);

  if (!draft) {
    setError('Draft was not found.');
    return;
  }

  if (isNumberLocked(draft.status)) {
    setError('A minted NFT cannot be edited here.');
    return;
  }

  const edited = readItemEditorValues();
  const attributes = normalizeAttributes(edited.attributes);

  if (!attributes.ok) {
    setError(attributes.error);
    return;
  }

  const updated = applyDraftEditorValues(draft, context.defaults, context.numbering, {
    ...edited,
    attributes: attributes.attributes,
  });
  updated.status = draft.status;
  await persistDraft(updated);
  const resolved = resolveDraftMetadata(updated, context.defaults, context.numbering);

  if (itemEditorPending) {
    await loadPendingDrafts();
  } else {
    selectedDraftId = updated.id;
    await renderCollectionManager();
  }

  closeItemEditor();
  setStatus(`Saved ${resolved.name}. Nothing was uploaded or minted.`);
}

function readAttributeInputs(): Array<{ trait_type: string; value: string }> {
  return readAttributeInputsFrom(attributeRows);
}

function addAttributeRow(trait = '', value = ''): void {
  addAttributeRowTo(attributeRows, trait, value, updatePreview);
}

function readFormInput() {
  const nameInput = document.querySelector<HTMLInputElement>('#nftName');
  const symbolInput = document.querySelector<HTMLInputElement>('#nftSymbol');
  const descriptionInput = document.querySelector<HTMLTextAreaElement>('#nftDescription');
  const externalUrlInput = document.querySelector<HTMLInputElement>('#nftExternalUrl');
  const royaltyInput = document.querySelector<HTMLInputElement>('#nftRoyalty');

  return {
    name: nameInput?.value ?? '',
    symbol: symbolInput?.value ?? '',
    description: descriptionInput?.value ?? '',
    externalUrl: externalUrlInput?.value ?? '',
    royaltyPercent: royaltyInput?.value ?? '0',
    isMutable: mutableCheckbox.checked,
    creatorAddress: connectedWalletAddress,
    attributes: readAttributeInputs(),
    artwork: artworkInput.files?.[0]
      ? {
          type: artworkInput.files[0].type,
          name: artworkInput.files[0].name,
          size: artworkInput.files[0].size,
        }
      : null,
  };
}

function updateMutableHelp(): void {
  mutableHelp.textContent = mutableCheckbox.checked
    ? 'On: you can update this NFT’s details later from the same wallet.'
    : 'Off: details stay fixed after minting.';
}

function updatePreview(metadataUri?: string): void {
  updateMutableHelp();
  const validated = validateUniqueNftForm(readFormInput());

  if (!validated.ok) {
    previewPanel.innerHTML = `
      <h3>Preview</h3>
      <p class="helper-text">${escapeHtml(validated.error)}</p>
    `;
    return;
  }

  previewPanel.innerHTML = renderPreviewMarkup({
    ...validated.value,
    network: getSelectedNetwork(),
    artworkPreviewUrl: artworkObjectUrl,
    metadataUri,
  });
}

function setBuilderMode(mode: BuilderMode): void {
  builderMode = mode;
  syncBuilderNav();
  resultPanel.hidden = true;
  if (mode !== 'manage-collection') {
    collectionStudioPane = 'gallery';
  }
  if (mode === 'manage-collection' && activeCollection) {
    void showCollectionManager({ fetchOnChain: false });
    return;
  }
  applyBuilderVisibility();
  refreshManageCollectionLists();
  if (mode === 'create-collection') {
    updateCollectionPreview();
  } else if (mode === 'nft') {
    updatePreview();
  }
}

function readCollectionFormInput() {
  return {
    name: requireElement<HTMLInputElement>('#collectionName').value,
    symbol: requireElement<HTMLInputElement>('#collectionSymbol').value,
    description: requireElement<HTMLTextAreaElement>('#collectionDescription').value,
    externalUrl: requireElement<HTMLInputElement>('#collectionExternalUrl').value,
    royaltyPercent: requireElement<HTMLInputElement>('#collectionRoyalty').value,
    isMutable: requireElement<HTMLInputElement>('#collectionMutable').checked,
    creatorAddress: connectedWalletAddress,
    attributes: [] as Array<{ trait_type: string; value: string }>,
    artwork: collectionArtworkInput.files?.[0]
      ? {
          type: collectionArtworkInput.files[0].type,
          name: collectionArtworkInput.files[0].name,
          size: collectionArtworkInput.files[0].size,
        }
      : null,
  };
}

function updateCollectionPreview(metadataUri?: string): void {
  const numbering = readStudioNumberingFromCreateForm();
  const numberingCheck = validateStudioNumbering(numbering);
  collectionNumberingPreview.innerHTML = numberingCheck.ok
    ? renderNumberingPreviewMarkup(numberingCheck.value)
    : `<p class="helper-text">${escapeHtml(numberingCheck.error)}</p>`;

  const validated = validateUniqueNftForm(readCollectionFormInput());

  if (!validated.ok) {
    collectionPreview.innerHTML = `
      <h3>Preview</h3>
      <p class="helper-text">${escapeHtml(validated.error)}</p>
    `;
    return;
  }

  collectionPreview.innerHTML = renderCollectionPreviewMarkup({
    ...validated.value,
    network: getSelectedNetwork(),
    artworkPreviewUrl: collectionArtworkObjectUrl,
    metadataUri,
    plannedMaxItems: numbering.plannedCapacity,
    numberingPreview: numberingCheck.ok ? previewStudioNames(numberingCheck.value) : [],
  });
}

function bindCollectionOpenButtons(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('[data-collection-mint]').forEach((button) => {
    button.addEventListener('click', () => {
      void openCollection(button.dataset.collectionMint ?? '');
    });
  });
}

function refreshRecentCollections(): void {
  const collections = loadRecentCollections(getSelectedNetwork());
  recentCollectionsBlock.hidden = collections.length === 0;
  recentCollectionsList.innerHTML = renderRecentCollectionsMarkup(collections);
  bindCollectionOpenButtons(recentCollectionsList);
}

async function refreshYourCollections(): Promise<void> {
  const seq = ++managedDiscoverySeq;

  if (!connectedWalletAddress) {
    yourCollectionsStatus.hidden = false;
    yourCollectionsStatus.textContent = YOUR_COLLECTIONS_WALLET_DISCONNECTED;
    yourCollectionsList.innerHTML = '';
    return;
  }

  yourCollectionsStatus.hidden = false;
  yourCollectionsStatus.textContent = 'Looking for collections you manage…';
  yourCollectionsList.innerHTML = '';

  const result = await discoverManagedCollections({
    network: getSelectedNetwork(),
    walletAddress: connectedWalletAddress,
  });

  if (seq !== managedDiscoverySeq) {
    return;
  }

  if (!result.ok) {
    yourCollectionsStatus.hidden = false;
    yourCollectionsStatus.textContent = YOUR_COLLECTIONS_LOAD_FAILED;
    yourCollectionsList.innerHTML = '';
    return;
  }

  if (result.collections.length === 0) {
    yourCollectionsStatus.hidden = false;
    yourCollectionsStatus.textContent = YOUR_COLLECTIONS_NONE_FOUND;
    yourCollectionsList.innerHTML = '';
    return;
  }

  yourCollectionsStatus.hidden = true;
  yourCollectionsStatus.textContent = '';
  yourCollectionsList.innerHTML = renderManagedCollectionsMarkup(result.collections);
  bindCollectionOpenButtons(yourCollectionsList);
}

function refreshManageCollectionLists(): void {
  refreshRecentCollections();
  if (builderMode === 'manage-collection' && !activeCollection) {
    void refreshYourCollections();
  }
}

function mintedNumbers(collection: CachedCollection): number[] {
  return collection.items.map((item) => item.number);
}

async function loadPendingDrafts(): Promise<void> {
  pendingDrafts = await studioStore.getDrafts(pendingCollectionKey());
  pendingDraftList.innerHTML = renderDraftListMarkup(pendingDrafts);
  bindDraftListActions(pendingDraftList, true);
}

async function loadStudioDraftsForActiveCollection(): Promise<void> {
  const key = activeCollectionKey();
  studioDrafts = key ? await studioStore.getDrafts(key) : [];
  for (const draft of studioDrafts) {
    if (draft.status === 'failed' && !hasOnChainMintProof(draft)) {
      await studioStore.putDraft(draft);
    }
  }
}

function bindDraftListActions(container: HTMLElement, pending: boolean): void {
  container.querySelectorAll<HTMLButtonElement>('[data-draft-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.draftId ?? '';
      const action = button.dataset.draftAction ?? '';
      void handleDraftAction(action, id, pending);
    });
  });
}

async function handleDraftAction(action: string, draftId: string, pending: boolean): Promise<void> {
  const drafts = pending ? pendingDrafts : studioDrafts;

  if (action === 'edit') {
    if (pending) {
      await openItemEditor(draftId, true);
      return;
    }

    const draft = studioDrafts.find((item) => item.id === draftId);
    if (!draft) {
      return;
    }

    await selectDraft(draft.id);
    revealCollectionItemEditor(draft.name);
    return;
  }

  if (action === 'mint') {
    if (pending) {
      setStatus('Mint after the collection is created. Open Collection Manager first.');
      return;
    }

    await mintCollectionDraftById(draftId);
    return;
  }

  if (action === 'remove') {
    const next = removeDraft(drafts, draftId);

    if ('error' in next) {
      setError(next.error);
      return;
    }

    await studioStore.deleteDraft(draftId);
    await studioStore.deleteBlob(draftId);

    if (pending) {
      pendingDrafts = next;
      await loadPendingDrafts();
    } else {
      studioDrafts = next;
      if (selectedDraftId === draftId) {
        selectedDraftId = null;
        editingDraftIdInput.value = '';
      }
      await renderCollectionManager();
    }

    setStatus('Draft removed. No blockchain transaction was sent.');
    return;
  }

  if (action === 'up' || action === 'down') {
    const ordered = [...drafts].sort((a, b) => a.sortIndex - b.sortIndex);
    const index = ordered.findIndex((draft) => draft.id === draftId);
    const target = action === 'up' ? index - 1 : index + 1;
    const reordered = reorderPreparedDrafts(drafts, draftId, target);

    if ('error' in reordered) {
      setError(reordered.error);
      return;
    }

    await persistDraftList(reordered);

    if (pending) {
      pendingDrafts = reordered;
      await loadPendingDrafts();
    } else {
      studioDrafts = reordered;
      await renderCollectionManager();
    }
  }
}

async function selectDraft(draftId: string): Promise<void> {
  const draft = studioDrafts.find((item) => item.id === draftId);

  if (!draft || !activeCollection) {
    return;
  }

  selectedDraftId = draft.id;
  editingDraftIdInput.value = draft.id;
  const defaults = defaultsFromCollection(activeCollection);
  const numbering = numberingFromCollection(activeCollection);
  const inherited = resolveDraftMetadata(draft, defaults, numbering);
  requireElement<HTMLInputElement>('#collectionItemName').value = inherited.name;
  requireElement<HTMLInputElement>('#collectionItemSymbol').value = defaults.symbol;
  requireElement<HTMLTextAreaElement>('#collectionItemDescription').value = inherited.description;
  requireElement<HTMLInputElement>('#collectionItemExternalUrl').value = inherited.externalUrl;
  requireElement<HTMLInputElement>('#collectionItemRoyalty').value = String(defaults.royaltyPercent);
  requireElement<HTMLInputElement>('#collectionItemMutable').checked = defaults.isMutable;
  replaceAttributeRows(collectionItemAttributeRows, inherited.attributes);

  if (collectionItemArtworkObjectUrl) {
    URL.revokeObjectURL(collectionItemArtworkObjectUrl);
    collectionItemArtworkObjectUrl = null;
  }

  const blob = await studioStore.getBlob(draft.id);

  if (blob) {
    const file = new File([blob], draft.artwork?.name || 'artwork.png', {
      type: draft.artwork?.type || blob.type || 'image/png',
    });
    assignFileToInput(collectionItemArtworkInput, file);
    collectionItemArtworkObjectUrl = URL.createObjectURL(file);
    collectionItemArtworkPreview.src = collectionItemArtworkObjectUrl;
    collectionItemArtworkPreview.hidden = false;
  } else {
    collectionItemArtworkInput.value = '';
    collectionItemArtworkPreview.hidden = true;
  }

  setStatus(`Editing ${draft.name}. Minting still happens one item at a time.`);
}

async function importArtworkIntoStudio(files: File[], pending: boolean): Promise<void> {
  const classified = classifyArtworkFiles(files);

  if (classified.accepted.length === 0) {
    const firstError = classified.rejected[0]?.error ?? 'No supported images were selected.';
    setError(firstError);
    return;
  }

  if (!pending && !lastItemDiscovery?.ok) {
    setError(lastItemDiscovery?.error ?? COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
    return;
  }

  const numbering = pending
    ? readStudioNumberingFromCreateForm()
    : activeCollection
      ? numberingFromCollection(activeCollection)
      : readStudioNumberingFromCreateForm();
  const numberingCheck = validateStudioNumbering(numbering);

  if (!numberingCheck.ok) {
    setError(numberingCheck.error);
    return;
  }

  const defaults = pending || !activeCollection
    ? readStudioDefaultsFromCreateForm()
    : defaultsFromCollection(activeCollection);
  const existing = pending ? pendingDrafts : studioDrafts;
  const minted = pending
    ? []
    : activeCollection
      ? mintedNumbersFromRecords(
          activeCollection.items,
          existing,
          lastItemDiscovery?.ok ? lastItemDiscovery.items : []
        )
      : [];
  const imported = importFilesAsDrafts({
    files: classified.accepted.map((item) => item.artwork),
    mintedNumbers: minted,
    existingDrafts: existing,
    numbering: numberingCheck.value,
    defaults,
    network: getSelectedNetwork(),
    collectionMint: pending ? null : activeCollection?.mint ?? null,
    collectionKey: pending ? pendingCollectionKey() : activeCollectionKey() ?? pendingCollectionKey(),
  });

  for (const [index, draft] of imported.drafts.entries()) {
    await persistDraft(draft, classified.accepted[index]?.file);
  }

  const skippedExtra = classified.rejected.length + imported.skipped;
  const message = `Prepared ${imported.drafts.length} draft${imported.drafts.length === 1 ? '' : 's'}. Nothing was uploaded or minted.${skippedExtra ? ` ${skippedExtra} file(s) skipped.` : ''}`;

  if (pending) {
    await loadPendingDrafts();
    setStatus(message);
  } else {
    studioImportStatus.textContent = message;
    await renderCollectionManager();
    setStatus(message);
  }
}

function bindDropzone(
  zone: HTMLElement,
  fileInput: HTMLInputElement,
  pending: boolean
): void {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragging');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('is-dragging');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragging');
    const transfer = event.dataTransfer;

    if (!transfer) {
      return;
    }

    void collectArtworkFiles(transfer).then((files) => importArtworkIntoStudio(files, pending));
  });
  fileInput.addEventListener('change', () => {
    const files = fileInput.files ? Array.from(fileInput.files) : [];
    void importArtworkIntoStudio(files, pending);
    fileInput.value = '';
  });
}

async function refreshActiveCollectionFromChain(): Promise<void> {
  if (!activeCollection) {
    return;
  }

  const networkCheck = assertCollectionNetworkMatch(
    activeCollection.network,
    getSelectedNetwork()
  );

  if (!networkCheck.ok) {
    setError(networkCheck.error);
    activeCollection = null;
    lastOnChainView = null;
    lastItemDiscovery = null;
    applyBuilderVisibility();
    return;
  }

  try {
    const onChain = await fetchCollectionOnChain(
      activeCollection.network,
      activeCollection.mint
    );
    lastOnChainView = onChain;
    lastItemDiscovery = await discoverCollectionItems({
      network: activeCollection.network,
      collectionMint: activeCollection.mint,
      onChainVerifiedSize: onChain.onChainVerifiedSize,
    });

    if (lastItemDiscovery.ok) {
      const discoveredItems = cachedItemsFromDiscovered(lastItemDiscovery.items);
      activeCollection = {
        ...activeCollection,
        name: onChain.name || activeCollection.name,
        symbol: onChain.symbol || activeCollection.symbol,
        items: discoveredItems,
      };
    } else {
      activeCollection = {
        ...activeCollection,
        name: onChain.name || activeCollection.name,
        symbol: onChain.symbol || activeCollection.symbol,
      };
      setError(lastItemDiscovery.error);
    }

    upsertRecentCollection(activeCollection.network, activeCollection);
    rememberOpenedCollection(activeCollection);
    await persistStudioSnapshot();
  } catch (error) {
    lastItemDiscovery = {
      ok: false,
      error: COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
      method: 'getAssetsByGroup',
      readOnly: true,
      network: activeCollection.network,
    };
    setError(mapErrorToUserMessage(error));
  }

  await renderCollectionManager();
}

async function renderCollectionManager(): Promise<void> {
  if (!activeCollection) {
    applyBuilderVisibility();
    return;
  }

  await loadStudioDraftsForActiveCollection();
  await loadStudioPreviewUrls(studioDrafts);
  const numbering = numberingFromCollection(activeCollection);
  const discovered = lastItemDiscovery?.ok ? lastItemDiscovery.items : [];
  const progress = collectionProgress({
    items: activeCollection.items,
    drafts: studioDrafts,
    discovery: lastItemDiscovery,
  });
  const nextNumber = progress.numberingBlocked
    ? null
    : nextNumberForExistingCollection(
        activeCollection.items,
        studioDrafts,
        numbering,
        discovered
      );
  const nextLabel = progress.numberingBlocked
    ? 'disabled'
    : nextNumber
      ? formatStudioItemNumber(nextNumber, numbering.digitCount)
      : `none (planned ${numbering.plannedCapacity} reached)`;
  const capacity = studioCapacityView({
    plannedCapacity: numbering.plannedCapacity,
    mintedCount: progress.minted ?? 0,
    verifiedCount: progress.verified ?? 0,
    drafts: studioDrafts,
  });
  const managerItems = mergeManagerListItems({
    discovered,
    drafts: studioDrafts,
    artworkPreviewUrls: studioDraftPreviewUrls,
  });

  collectionManager.hidden = false;
  collectionManagerSummary.innerHTML = renderCollectionManagerMarkup({
    cache: activeCollection,
    onChain: lastOnChainView,
    capacity,
    nextNumberLabel: nextLabel,
    preparedCount: progress.prepared,
    mintedCount: progress.minted,
    verifiedCount: progress.verified,
    numberingBlocked: progress.numberingBlocked,
    discoveryError: progress.discoveryError,
  });
  studioDraftList.innerHTML = renderManagerItemListMarkup(managerItems, {
    digitCount: numbering.digitCount,
    network: activeCollection.network,
    numberingBlocked: progress.numberingBlocked,
  });
  const addNftDraftButton = requireElement<HTMLButtonElement>('#addNftDraftButton');
  studioDraftList.appendChild(addNftDraftButton);
  const studioTech = collectionManagerSummary.querySelector('.studio-tech');
  const studioAdvanced = collectionManager.querySelector('.studio-advanced');
  const advancedSummary = studioAdvanced?.querySelector('summary');
  if (studioTech && advancedSummary) {
    advancedSummary.insertAdjacentElement('afterend', studioTech);
  }
  bindCollectionManagerActions();
  bindDraftListActions(studioDraftList, false);
  collectionNextNumber.textContent = progress.numberingBlocked
    ? COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE
    : `Next available number: ${nextLabel}`;

  if (!selectedDraftId && nextNumber) {
    requireElement<HTMLInputElement>('#collectionItemName').value = buildCollectionItemName(
      numbering.baseName,
      nextNumber,
      numbering.digitCount
    );
    requireElement<HTMLInputElement>('#collectionItemSymbol').value = activeCollection.symbol || '';
    requireElement<HTMLTextAreaElement>('#collectionItemDescription').value =
      activeCollection.commonDescription || '';
    requireElement<HTMLInputElement>('#collectionItemExternalUrl').value =
      activeCollection.commonExternalUrl || '';
    requireElement<HTMLInputElement>('#collectionItemRoyalty').value = String(
      activeCollection.commonRoyaltyPercent
    );
    requireElement<HTMLInputElement>('#collectionItemMutable').checked =
      activeCollection.isMutableDefault;
    replaceAttributeRows(collectionItemAttributeRows, activeCollection.commonAttributes);
  }

  if (selectedDraftId) {
    await selectDraft(selectedDraftId);
  }

  addExistingNftButton.disabled = true;
  pendingExistingNftMint = null;
  syncCollectionStudioPane(
    selectedDraftId
      ? studioDrafts.find((draft) => draft.id === selectedDraftId)?.name
      : undefined
  );
}

async function openCollection(mintAddress: string): Promise<void> {
  const mint = mintAddress.trim();

  if (!mint) {
    setError('Enter a collection mint address.');
    return;
  }

  const network = getSelectedNetwork();
  const cached = findCachedCollection(network, mint);
  const otherCache = findCachedCollectionOnOtherNetwork(network, mint);
  const selectedSettings = await studioStore.getSettings(collectionStudioKey(network, mint));
  const otherNetwork = network === 'mainnet' ? 'devnet' : 'mainnet';
  const otherSettings = await studioStore.getSettings(collectionStudioKey(otherNetwork, mint));
  const isolation = refuseCollectionOpenOnWrongNetwork({
    selectedNetwork: network,
    selectedCache: cached,
    otherCache,
    selectedSettings,
    otherSettings,
  });

  if (!isolation.ok) {
    setError(isolation.error);
    return;
  }

  const localFromSettings = selectedSettings ? cachedCollectionFromSettings(selectedSettings) : null;
  const localCollection = cached
    ? selectedSettings
      ? collectionFromSnapshot(selectedSettings, cached)
      : cached
    : localFromSettings;

  let onChain: OnChainCollectionView | null = null;

  try {
    onChain = await fetchCollectionOnChain(network, mint);
  } catch (error) {
    if (!localCollection) {
      setError(mapErrorToUserMessage(error));
      return;
    }

    lastOnChainView = null;
    lastItemDiscovery = {
      ok: false,
      error: COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE,
      method: 'getAssetsByGroup',
      readOnly: true,
      network,
    };
    activeCollection = localCollection;
    upsertRecentCollection(network, activeCollection);
    rememberOpenedCollection(activeCollection);
    await persistStudioSnapshot();
    refreshRecentCollections();
    collectionStudioPane = 'gallery';
    selectedDraftId = null;
    await showCollectionManager({ fetchOnChain: false });
    setError(
      'Could not fetch this collection on-chain. Showing saved local progress. Minting is blocked until the collection is confirmed on this network.'
    );
    return;
  }

  if (!onChain.isCollection) {
    setError('This mint is not a Metaplex collection NFT.');
    return;
  }

  lastOnChainView = onChain;
  const base: CachedCollection = localCollection ?? {
    mint: onChain.mint,
    network,
    name: onChain.name,
    symbol: onChain.symbol,
    plannedMaxItems: DEFAULT_PLANNED_CAPACITY,
    itemNamePrefix: itemPrefixFromCollectionName(onChain.name),
    digitCount: DEFAULT_DIGIT_COUNT,
    startNumber: DEFAULT_START_NUMBER,
    commonDescription: '',
    commonExternalUrl: '',
    commonRoyaltyPercent: 0,
    commonAttributes: [],
    isMutableDefault: true,
    items: [],
  };

  activeCollection = {
    ...base,
    mint: onChain.mint,
    network,
    name: onChain.name || base.name,
    symbol: onChain.symbol || base.symbol,
  };

  if (selectedSettings) {
    activeCollection = collectionFromSnapshot(selectedSettings, activeCollection);
    activeCollection = {
      ...activeCollection,
      name: onChain.name || activeCollection.name,
      symbol: onChain.symbol || activeCollection.symbol,
    };
  }

  upsertRecentCollection(network, activeCollection);
  rememberOpenedCollection(activeCollection);
  await persistStudioSnapshot();
  refreshRecentCollections();
  collectionStudioPane = 'gallery';
  selectedDraftId = null;
  await showCollectionManager({ fetchOnChain: true });
  setStatus(
    `Opened ${activeCollection.name} on ${network === 'mainnet' ? 'Mainnet' : 'Devnet'}. No new collection was created.`
  );
}

async function addNftDraftToActiveCollection(): Promise<void> {
  if (!activeCollection) {
    setError('Open an existing collection before adding an NFT.');
    return;
  }

  const networkCheck = assertCollectionNetworkMatch(
    activeCollection.network,
    getSelectedNetwork()
  );

  if (!networkCheck.ok) {
    setError(networkCheck.error);
    return;
  }

  await loadStudioDraftsForActiveCollection();
  const created = addItemDraftToExistingCollection({
    collection: activeCollection,
    existingDrafts: studioDrafts,
    numbering: numberingFromCollection(activeCollection),
    defaults: defaultsFromCollection(activeCollection),
    discovery: lastItemDiscovery,
  });

  if ('error' in created) {
    setError(created.error);
    return;
  }

  await persistDraft(created);
  selectedDraftId = created.id;
  editingDraftIdInput.value = created.id;
  collectionStudioPane = 'item-editor';
  await persistStudioSnapshot();
  await renderCollectionManager();
  revealCollectionItemEditor(created.name);
  setStatus(
    `Added ${created.name} as a local draft. This did not create a collection NFT.`
  );
}

function bindMintResultActions(model: MintDisplayModel): void {
  resultPanel.querySelector('#copyMintAddress')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(model.mintAddress);
    setStatus('Mint address copied.');
  });

  resultPanel.querySelector('#replayMintResult')?.addEventListener('click', () => {
    replayMintResultDisplay();
  });

  resultPanel.querySelector('#createAnotherNft')?.addEventListener('click', () => {
    nftForm.reset();
    mutableCheckbox.checked = true;
    attributeRows.innerHTML = '';
    resultPanel.hidden = true;
    resultPanel.innerHTML = '';
    if (artworkObjectUrl) {
      URL.revokeObjectURL(artworkObjectUrl);
      artworkObjectUrl = null;
    }
    artworkPreview.hidden = true;
    updatePreview();
    setStatus('Ready to create another unique NFT.');
  });
}

function showMintResult(model: MintDisplayModel): void {
  lastMintDisplay = model;
  resultPanel.hidden = false;
  resultPanel.innerHTML = renderMintResultMarkup(model);
  bindMintResultActions(model);
}

function replayMintResultDisplay(): void {
  const stored = replayStoredMintDisplay(lastMintDisplay);

  if (!stored) {
    setStatus('No previous mint result to show.');
    return;
  }

  showMintResult(stored);
  setStatus('Showing the previous mint result. No new transaction was sent.');
}

function renderResult(options: {
  name: string;
  mintAddress: string;
  signature: string;
  network: SolanaNetwork;
  metadataUri: string;
  artworkPreviewUrl: string | null;
  showIndexingNotice: boolean;
}): void {
  showMintResult({
    name: options.name,
    mintAddress: options.mintAddress,
    signature: options.signature,
    networkLabel: options.network === 'mainnet' ? 'Mainnet' : 'Devnet',
    metadataUri: options.metadataUri,
    tokenStandard: 'NonFungible',
    artworkPreviewUrl: options.artworkPreviewUrl,
    showIndexingNotice: options.showIndexingNotice,
  });
}

async function ensureReadyToMint(): Promise<{
  wallet: SolanaWalletProvider;
  walletId: string;
  address: string;
  network: SolanaNetwork;
}> {
  if (!connectedWallet || !connectedWalletAddress) {
    throw new Error('Connect a wallet before minting.');
  }

  if (!walletSupportsTokenCreation(connectedWallet)) {
    throw new Error(WALLET_UNSUPPORTED_SIGNING_MESSAGE);
  }

  const network = getSelectedNetwork();

  if (network === 'mainnet' && !isMainnetRpcConfigured()) {
    throw new Error(MAINNET_RPC_NOT_CONFIGURED_MESSAGE);
  }

  getRpc(network);

  const report = getWalletNetworkReport(
    selectedWalletId,
    network,
    connectedWallet,
    connectedWalletAddress
  );

  if (report.status === 'mismatch' && report.walletNetwork) {
    throw new Error(
      `Wallet network mismatch. The app is on ${network} but the wallet appears to be on ${report.walletNetwork}.`
    );
  }

  const lamports = await getWalletLamports(network, connectedWalletAddress);

  if (lamports < MIN_NFT_MINT_LAMPORTS) {
    throw new Error(
      `Not enough SOL in this wallet to pay network fees. Balance: ${formatSol(lamports)} SOL.`
    );
  }

  return {
    wallet: connectedWallet,
    walletId: selectedWalletId,
    address: connectedWalletAddress,
    network,
  };
}

nftForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isBusy || builderMode !== 'nft') {
    return;
  }

  const artworkFile = artworkInput.files?.[0] ?? null;
  const validated = validateUniqueNftForm(readFormInput());

  if (!validated.ok) {
    setError(validated.error);
    updatePreview();
    return;
  }

  if (!artworkFile) {
    setError('Select an artwork file before minting.');
    return;
  }

  isBusy = true;
  resultPanel.hidden = true;

  try {
    const ready = await ensureReadyToMint();
    updatePreview();

    showActionPopup(
      'Authorize upload',
      'Authorize upload for CBS NFT Builder. This does not move tokens or SOL.',
      'loading'
    );

    const uploadAuth = await requestPinataUploadAuthorization(
      ready.wallet,
      ready.address,
      ready.walletId
    );

    showActionPopup('Uploading artwork', 'Uploading artwork to IPFS...', 'loading');
    const uploadedArtwork = await uploadFileToPinata(artworkFile, uploadAuth);

    const metadata = buildNftMetadata({
      name: validated.value.name,
      symbol: validated.value.symbol,
      description: validated.value.description,
      imageIpfsUri: uploadedArtwork.ipfsUri,
      imageMimeType: validated.value.artworkMimeType,
      externalUrl: validated.value.externalUrl || undefined,
      attributes: validated.value.attributes,
      creatorAddress: validated.value.creatorAddress,
    });

    showActionPopup('Uploading metadata', 'Uploading NFT metadata to IPFS...', 'loading');
    const uploadedMetadata = await uploadNftMetadataToPinata(metadata, uploadAuth);
    updatePreview(uploadedMetadata.ipfsUri);

    showActionPopup(
      'Confirm mint',
      'Your wallet will now sign the mint transaction for one unique NFT.',
      'loading'
    );

    const minted = await mintUniqueNft({
      network: ready.network,
      walletProvider: ready.wallet,
      name: validated.value.name,
      symbol: validated.value.symbol,
      metadataUri: uploadedMetadata.ipfsUri,
      royaltyPercent: validated.value.royaltyPercent,
      creatorAddress: ready.address,
      isMutable: validated.value.isMutable,
    });

    renderResult({
      name: validated.value.name,
      mintAddress: minted.mintAddress,
      signature: minted.signature,
      network: ready.network,
      metadataUri: uploadedMetadata.ipfsUri,
      artworkPreviewUrl: artworkObjectUrl,
      showIndexingNotice: minted.showIndexingNotice,
    });

    setStatus(`NFT created. Mint ${shortAddress(minted.mintAddress)}`);
    showActionPopup(
      NFT_CREATED_HEADING,
      minted.showIndexingNotice
        ? 'The unique NFT was minted. Wallets and explorers may need a moment to index it.'
        : 'The unique NFT was minted.',
      'success'
    );
    hideActionPopup(1600);
  } catch (error) {
    console.error(error);
    const message = mapErrorToUserMessage(error);
    setError(message);
    showActionPopup('NFT creation failed', message, 'error');
    hideActionPopup(2200);
  } finally {
    isBusy = false;
  }
});

connectButton.addEventListener('click', async () => {
  try {
    await connectSelectedWallet(false);
    updatePreview();
    refreshManageCollectionLists();
    setStatus('Wallet connected.');
  } catch (error) {
    console.error(error);
    clearWalletState();
    setError(mapErrorToUserMessage(error));
  }
});

disconnectButton.addEventListener('click', async () => {
  await disconnectWallet();
  updatePreview();
  refreshManageCollectionLists();
  setStatus('Wallet disconnected.');
});

walletSelect.addEventListener('change', () => {
  selectedWalletId = walletSelect.value;
});

networkSelect.addEventListener('change', () => {
  updateNetworkStatus();
  updateMainnetWarning();
  updatePreview();
  updateCollectionPreview();
  refreshManageCollectionLists();
  if (
    activeCollection &&
    activeCollection.network !== getSelectedNetwork()
  ) {
    setError(wrongNetworkCollectionMessage(activeCollection.network, getSelectedNetwork()));
    activeCollection = null;
    lastOnChainView = null;
    lastItemDiscovery = null;
    collectionManager.hidden = true;
    applyBuilderVisibility();
  }
  void loadPendingDrafts();
});

artworkInput.addEventListener('change', () => {
  if (artworkObjectUrl) {
    URL.revokeObjectURL(artworkObjectUrl);
    artworkObjectUrl = null;
  }

  const file = artworkInput.files?.[0];

  if (!file) {
    artworkPreview.hidden = true;
    updatePreview();
    return;
  }

  artworkObjectUrl = URL.createObjectURL(file);
  artworkPreview.src = artworkObjectUrl;
  artworkPreview.hidden = false;
  updatePreview();
});

addAttributeButton.addEventListener('click', () => {
  addAttributeRow();
});

nftForm.addEventListener('input', () => {
  updatePreview();
});

mutableCheckbox.addEventListener('change', () => {
  updatePreview();
});

document.querySelectorAll<HTMLButtonElement>('[data-asset-type]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }

    const mode = button.dataset.assetType;
    if (
      mode === 'nft' ||
      mode === 'create-collection' ||
      mode === 'manage-collection'
    ) {
      setBuilderMode(mode);
    }
  });
});

homeBrandButton.addEventListener('click', () => {
  setBuilderMode('home');
});

collectionArtworkInput.addEventListener('change', () => {
  if (collectionArtworkObjectUrl) {
    URL.revokeObjectURL(collectionArtworkObjectUrl);
    collectionArtworkObjectUrl = null;
  }

  const file = collectionArtworkInput.files?.[0];

  if (!file) {
    collectionArtworkPreview.hidden = true;
    updateCollectionPreview();
    return;
  }

  collectionArtworkObjectUrl = URL.createObjectURL(file);
  collectionArtworkPreview.src = collectionArtworkObjectUrl;
  collectionArtworkPreview.hidden = false;
  updateCollectionPreview();
});

collectionForm.addEventListener('input', () => {
  updateCollectionPreview();
});

collectionForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isBusy || builderMode !== 'create-collection') {
    return;
  }

  const artworkFile = collectionArtworkInput.files?.[0] ?? null;
  const validated = validateUniqueNftForm(readCollectionFormInput());

  if (!validated.ok) {
    setError(validated.error);
    updateCollectionPreview();
    return;
  }

  if (!artworkFile) {
    setError('Select collection artwork before creating a collection.');
    return;
  }

  isBusy = true;
  resultPanel.hidden = true;

  try {
    const numberingCheck = validateStudioNumbering(readStudioNumberingFromCreateForm());

    if (!numberingCheck.ok) {
      setError(numberingCheck.error);
      updateCollectionPreview();
      return;
    }

    const ready = await ensureReadyToMint();
    planCollectionNft({
      isMutable: validated.value.isMutable,
      royaltyPercent: validated.value.royaltyPercent,
      creatorAddress: ready.address,
      plannedMaxItems: numberingCheck.value.plannedCapacity,
    });
    const uploadAuth = await requestPinataUploadAuthorization(
      ready.wallet,
      ready.address,
      ready.walletId
    );
    showActionPopup('Uploading artwork', 'Uploading collection artwork to IPFS...', 'loading');
    const uploadedArtwork = await uploadFileToPinata(artworkFile, uploadAuth);
    const metadata = buildNftMetadata({
      name: validated.value.name,
      symbol: validated.value.symbol,
      description: validated.value.description,
      imageIpfsUri: uploadedArtwork.ipfsUri,
      imageMimeType: validated.value.artworkMimeType,
      externalUrl: validated.value.externalUrl || undefined,
      attributes: [],
      creatorAddress: ready.address,
    });
    showActionPopup('Uploading metadata', 'Uploading collection metadata to IPFS...', 'loading');
    const uploadedMetadata = await uploadNftMetadataToPinata(metadata, uploadAuth);
    showActionPopup(
      'Confirm collection',
      'Your wallet will sign the collection cover transaction.',
      'loading'
    );
    const created = await createCollectionNft({
      network: ready.network,
      walletProvider: ready.wallet,
      name: validated.value.name,
      symbol: validated.value.symbol,
      metadataUri: uploadedMetadata.ipfsUri,
      royaltyPercent: validated.value.royaltyPercent,
      creatorAddress: ready.address,
      isMutable: validated.value.isMutable,
    });

    const defaults = readStudioDefaultsFromCreateForm();
    activeCollection = {
      mint: created.mintAddress,
      network: ready.network,
      name: validated.value.name,
      symbol: validated.value.symbol,
      plannedMaxItems: numberingCheck.value.plannedCapacity,
      itemNamePrefix: numberingCheck.value.baseName,
      digitCount: numberingCheck.value.digitCount,
      startNumber: numberingCheck.value.start,
      commonDescription: defaults.description,
      commonExternalUrl: defaults.externalUrl,
      commonRoyaltyPercent: defaults.royaltyPercent,
      commonAttributes: defaults.attributes,
      isMutableDefault: defaults.isMutable,
      items: [],
    };
    lastOnChainView = {
      mint: created.mintAddress,
      name: validated.value.name,
      symbol: validated.value.symbol,
      uri: uploadedMetadata.ipfsUri,
      updateAuthority: ready.address,
      tokenStandard: 'NonFungible',
      isCollection: true,
      collectionDetailsKind: 'V1',
      onChainVerifiedSize: 0,
    };
    lastItemDiscovery = emptyCollectionDiscovery(ready.network);
    upsertRecentCollection(ready.network, activeCollection);
    rememberOpenedCollection(activeCollection);
    await studioStore.putSettings(
      snapshotFromCollection(activeCollection, numberingCheck.value, defaults)
    );
    const pending = await studioStore.getDrafts(pendingCollectionKey());
    const linked = attachDraftsToCollectionMint(pending, {
      collectionMint: created.mintAddress,
      network: ready.network,
    });
    await persistLinkedDrafts(linked);
    pendingDrafts = [];
    pendingDraftList.innerHTML = '';
    refreshRecentCollections();

    resultPanel.hidden = false;
    resultPanel.innerHTML = renderCollectionCreatedMarkup({
      name: validated.value.name,
      mintAddress: created.mintAddress,
      signature: created.signature,
      network: ready.network,
      metadataUri: uploadedMetadata.ipfsUri,
      artworkPreviewUrl: collectionArtworkObjectUrl,
      showIndexingNotice: created.showIndexingNotice,
      plannedMaxItems: numberingCheck.value.plannedCapacity,
      preparedDraftCount: linked.length,
    });
    await showCollectionManager({ fetchOnChain: false });
    setStatus(
      `Collection created. ${linked.length} prepared item${linked.length === 1 ? '' : 's'} ready in Collection Manager.`
    );
    showActionPopup('Collection created', 'The collection NFT was minted.', 'success');
    hideActionPopup(1600);
  } catch (error) {
    console.error(error);
    const message = mapErrorToUserMessage(error);
    setError(message);
    showActionPopup('Collection creation failed', message, 'error');
    hideActionPopup(2200);
  } finally {
    isBusy = false;
  }
});

collectionItemArtworkInput.addEventListener('change', () => {
  if (collectionItemArtworkObjectUrl) {
    URL.revokeObjectURL(collectionItemArtworkObjectUrl);
    collectionItemArtworkObjectUrl = null;
  }

  const file = collectionItemArtworkInput.files?.[0];

  if (!file) {
    collectionItemArtworkPreview.hidden = true;
    return;
  }

  collectionItemArtworkObjectUrl = URL.createObjectURL(file);
  collectionItemArtworkPreview.src = collectionItemArtworkObjectUrl;
  collectionItemArtworkPreview.hidden = false;
});

saveDraftButton.addEventListener('click', () => {
  void saveCurrentItemDraft();
});

backToCollectionButton.addEventListener('click', () => {
  returnToCollectionGallery();
});

itemEditorAddAttribute.addEventListener('click', () => {
  addAttributeRowTo(itemEditorAttributeRows, '', '', refreshItemEditorPreview);
  refreshItemEditorPreview();
});

itemEditorName.addEventListener('input', refreshItemEditorPreview);
itemEditorDescription.addEventListener('input', refreshItemEditorPreview);
itemEditorExternalUrl.addEventListener('input', refreshItemEditorPreview);

itemEditorSave.addEventListener('click', () => {
  void saveItemEditor();
});

itemEditorCancel.addEventListener('click', () => {
  closeItemEditor();
});

itemEditorOverlay.addEventListener('click', (event) => {
  if (event.target === itemEditorOverlay) {
    closeItemEditor();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !itemEditorOverlay.hidden) {
    closeItemEditor();
  }
});

addCollectionDefaultAttributeButton.addEventListener('click', () => {
  addAttributeRowTo(collectionDefaultAttributeRows, '', '', updateCollectionPreview);
});

addCollectionItemAttributeButton.addEventListener('click', () => {
  addAttributeRowTo(collectionItemAttributeRows);
});

pendingDraftFolderButton.addEventListener('click', () => {
  pendingDraftFolderInput.click();
});

studioFolderButton.addEventListener('click', () => {
  studioFolderInput.click();
});

pendingDraftFolderInput.addEventListener('change', () => {
  const files = pendingDraftFolderInput.files ? Array.from(pendingDraftFolderInput.files) : [];
  void importArtworkIntoStudio(files, true);
  pendingDraftFolderInput.value = '';
});

studioFolderInput.addEventListener('change', () => {
  const files = studioFolderInput.files ? Array.from(studioFolderInput.files) : [];
  void importArtworkIntoStudio(files, false);
  studioFolderInput.value = '';
});

bindDropzone(pendingDraftDropzone, pendingDraftArtworkInput, true);
bindDropzone(studioDraftDropzone, studioArtworkInput, false);

async function saveCurrentItemDraft(): Promise<void> {
  if (!activeCollection) {
    setError('Open a collection before saving a draft.');
    return;
  }

  const numbering = numberingFromCollection(activeCollection);
  const numberingCheck = validateStudioNumbering(numbering);

  if (!numberingCheck.ok) {
    setError(numberingCheck.error);
    return;
  }

  const file = collectionItemArtworkInput.files?.[0] ?? null;
  const artwork = file
    ? classifyArtworkFiles([file]).accepted[0]?.artwork ?? null
    : null;

  if (file && !artwork) {
    setError(classifyArtworkFiles([file]).rejected[0]?.error ?? 'Artwork is not supported.');
    return;
  }

  const name = requireElement<HTMLInputElement>('#collectionItemName').value.trim();
  const description = requireElement<HTMLTextAreaElement>('#collectionItemDescription').value;
  const externalUrl = requireElement<HTMLInputElement>('#collectionItemExternalUrl').value;
  const attributes = normalizeAttributes(
    readAttributeInputsFrom(collectionItemAttributeRows)
  );

  if (!attributes.ok) {
    setError(attributes.error);
    return;
  }

  const defaults = defaultsFromCollection(activeCollection);
  const existing = studioDrafts.find((draft) => draft.id === editingDraftIdInput.value);

  if (existing) {
    const withFields = applyDraftEditorValues(existing, defaults, numberingCheck.value, {
      name,
      description,
      externalUrl,
      attributes: attributes.attributes,
    });
    const updated = updateDraftFields(withFields, {
      artwork: artwork ?? existing.artwork,
    });

    if ('error' in updated) {
      setError(updated.error);
      return;
    }

    await persistDraft(updated, file);
    selectedDraftId = updated.id;
    await renderCollectionManager();
    setStatus(`Draft saved: ${updated.name}. Nothing was uploaded or minted.`);
    return;
  }

  if (!lastItemDiscovery?.ok) {
    setError(lastItemDiscovery?.error ?? COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
    return;
  }
  const number = nextNumberForExistingCollection(
    activeCollection.items,
    studioDrafts,
    numberingCheck.value,
    lastItemDiscovery.items
  );

  if (number === null) {
    setError(
      `CBS planned capacity of ${numberingCheck.value.plannedCapacity} items has been reached. This is not an on-chain maximum.`
    );
    return;
  }

  const draft = createStudioDraft({
    network: activeCollection.network,
    collectionMint: activeCollection.mint,
    collectionKey: activeCollectionKey() ?? pendingCollectionKey(),
    number,
    numbering: numberingCheck.value,
    defaults: defaultsFromCollection(activeCollection),
    artwork,
    sortIndex: studioDrafts.length,
  });
  const named = applyDraftEditorValues(draft, defaults, numberingCheck.value, {
    name,
    description,
    externalUrl,
    attributes: attributes.attributes,
  });
  const withArtwork = updateDraftFields(named, { artwork });

  if ('error' in withArtwork) {
    setError(withArtwork.error);
    return;
  }

  await persistDraft(withArtwork, file);
  selectedDraftId = withArtwork.id;
  editingDraftIdInput.value = withArtwork.id;
  await renderCollectionManager();
  setStatus(`Draft saved: ${withArtwork.name}. Nothing was uploaded or minted.`);
}

async function mintCollectionDraftById(draftId: string): Promise<void> {
  if (isBusy || !activeCollection) {
    return;
  }

  isBusy = true;
  let chainMintAddress: string | null = null;
  let workingDraft: StudioDraft | null = null;

  try {
    await loadStudioDraftsForActiveCollection();
    const draft = studioDrafts.find((item) => item.id === draftId);

    if (!draft) {
      setError('That prepared item was not found.');
      return;
    }

    workingDraft = draft;

    const networkCheck = assertCollectionNetworkMatch(
      activeCollection.network,
      getSelectedNetwork()
    );

    if (!networkCheck.ok) {
      setError(networkCheck.error);
      return;
    }

    if (!lastOnChainView?.isCollection || lastOnChainView.mint !== activeCollection.mint) {
      setError(
        'Confirm this collection on-chain before minting. No new collection will be created.'
      );
      return;
    }

    if (!lastItemDiscovery?.ok) {
      setError(lastItemDiscovery?.error ?? COLLECTION_ITEM_DISCOVERY_FAILURE_MESSAGE);
      return;
    }

    if (draft.mintAddress) {
      try {
        await fetchExistingNftSnapshot(activeCollection.network, draft.mintAddress);
      } catch {
        // Local mint address is enough to refuse a second mint.
      }
      setError('This item already has a mint address. It will not be minted again.');
      return;
    }

    const numbering = numberingFromCollection(activeCollection);
    const defaults = defaultsFromCollection(activeCollection);
    const prepared = prepareItemMintFromDraft(draft, defaults, numbering);

    if ('error' in prepared) {
      setError(prepared.error);
      return;
    }

    const target = assertMintTargetsDraft(prepared, draft);

    if (!target.ok) {
      setError(target.error);
      return;
    }

    const otherDraft = studioDrafts.find((item) => item.id !== draft.id);
    if (otherDraft && prepared.draftId === otherDraft.id) {
      setError(`${prepared.mintLabel} cannot mint ${otherDraft.name}.`);
      return;
    }

    const cap = canAddCollectionItem(activeCollection.items.length, numbering.plannedCapacity);

    if (!cap.ok) {
      setError(cap.error);
      return;
    }

    const used = usedNumbersForContinue(
      activeCollection.items,
      studioDrafts.filter((item) => item.id !== draft.id),
      lastItemDiscovery.items
    );
    const numberCheck = canAllocateItemNumber(
      used,
      prepared.number,
      numbering.plannedCapacity,
      numbering.start
    );

    if (!numberCheck.ok) {
      setError(numberCheck.error);
      return;
    }

    const blob = await studioStore.getBlob(draft.id);

    if (!blob || !prepared.artwork) {
      setError(`Add artwork to ${prepared.mintLabel.replace(/^Mint /, '')} before minting.`);
      return;
    }

    const artworkFile = new File([blob], prepared.artwork.name, {
      type: prepared.artwork.type || blob.type || 'image/png',
    });
    const validated = validateUniqueNftForm({
      name: prepared.name,
      symbol: prepared.symbol,
      description: prepared.description,
      externalUrl: prepared.externalUrl,
      royaltyPercent: String(prepared.royaltyPercent),
      isMutable: prepared.isMutable,
      creatorAddress: connectedWalletAddress,
      attributes: prepared.attributes,
      artwork: {
        type: artworkFile.type,
        name: artworkFile.name,
        size: artworkFile.size,
      },
    });

    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    resultPanel.hidden = true;
    selectedDraftId = draft.id;
    editingDraftIdInput.value = draft.id;

    const ready = await ensureReadyToMint();
    const uploadAuth = await requestPinataUploadAuthorization(
      ready.wallet,
      ready.address,
      ready.walletId
    );
    showActionPopup('Uploading artwork', `Uploading ${prepared.name} artwork to IPFS...`, 'loading');
    const uploadedArtwork = await uploadFileToPinata(artworkFile, uploadAuth);
    const metadata = buildNftMetadata({
      name: validated.value.name,
      symbol: validated.value.symbol,
      description: validated.value.description,
      imageIpfsUri: uploadedArtwork.ipfsUri,
      imageMimeType: validated.value.artworkMimeType,
      externalUrl: validated.value.externalUrl || undefined,
      attributes: validated.value.attributes,
      creatorAddress: ready.address,
    });
    showActionPopup('Uploading metadata', `Uploading ${prepared.name} metadata to IPFS...`, 'loading');
    const uploadedMetadata = await uploadNftMetadataToPinata(metadata, uploadAuth);
    showActionPopup(
      'Confirm mint',
      `Your wallet will mint ${prepared.name} into this collection and verify it.`,
      'loading'
    );
    workingDraft = draft;
    const minted = await createCollectionItemNft({
      network: ready.network,
      walletProvider: ready.wallet,
      collectionMint: activeCollection.mint,
      name: validated.value.name,
      symbol: validated.value.symbol,
      metadataUri: uploadedMetadata.ipfsUri,
      royaltyPercent: validated.value.royaltyPercent,
      creatorAddress: ready.address,
      isMutable: validated.value.isMutable,
    });
    chainMintAddress = minted.mintAddress;

    activeCollection = recordCachedItem(ready.network, activeCollection.mint, {
      mint: minted.mintAddress,
      number: prepared.number,
      verified: minted.collectionVerified,
    }) ?? activeCollection;

    const latest = (await studioStore.getDrafts(activeCollectionKey() ?? '')).find(
      (item) => item.id === draft.id
    ) ?? workingDraft;
    const completed = markDraftMintOutcome(latest, {
      status: draftStatusAfterMintSend({
        sendSucceeded: true,
        confirmSucceeded: minted.confirmSucceeded,
        collectionVerified: minted.collectionVerified,
        mintAddress: minted.mintAddress,
        signature: minted.signature,
      }),
      mintAddress: minted.mintAddress,
      mintSignature: minted.signature,
    });
    await persistDraft(completed);
    await persistStudioSnapshot();
    selectedDraftId = null;
    editingDraftIdInput.value = '';

    if (collectionItemArtworkObjectUrl) {
      URL.revokeObjectURL(collectionItemArtworkObjectUrl);
    }
    collectionItemArtworkObjectUrl = URL.createObjectURL(artworkFile);

    resultPanel.hidden = false;
    resultPanel.innerHTML = renderCollectionItemResultMarkup({
      name: validated.value.name,
      mintAddress: minted.mintAddress,
      signature: minted.signature,
      network: ready.network,
      metadataUri: uploadedMetadata.ipfsUri,
      artworkPreviewUrl: collectionItemArtworkObjectUrl,
      collectionName: activeCollection.name,
      collectionVerified: minted.collectionVerified,
      itemNumberLabel: formatStudioItemNumber(prepared.number, numbering.digitCount),
      showIndexingNotice: minted.showIndexingNotice,
    });
    selectedDraftId = null;
    editingDraftIdInput.value = '';
    collectionStudioPane = 'gallery';
    await renderCollectionManager();
    setStatus(`${prepared.name} minted in this collection. ${shortAddress(minted.mintAddress)}`);
    showActionPopup('NFT created', `${prepared.name} was minted.`, 'success');
    hideActionPopup(1600);
  } catch (error) {
    console.error(error);
    const latest =
      (workingDraft
        ? (await studioStore.getDrafts(activeCollectionKey() ?? '')).find(
            (item) => item.id === workingDraft?.id
          )
        : null) ?? workingDraft;
    const mintTransactionSubmitted =
      Boolean(chainMintAddress) ||
      latest?.status === 'mint_submitted' ||
      latest?.status === 'minted' ||
      latest?.status === 'collection_verified';
    const message = mapErrorToUserMessage(error, { mintTransactionSubmitted });

    if (chainMintAddress && latest) {
      await persistDraft(
        markDraftMintOutcome(latest, {
          status: 'minted',
          mintAddress: chainMintAddress,
        })
      );
      await persistStudioSnapshot();
      await renderCollectionManager();
      setError(
        'The NFT was minted, but saving local status failed. Do not mint this item again. Check the explorer.'
      );
      return;
    }

    if (latest && shouldMarkDraftFailedAfterMintError(latest, chainMintAddress)) {
      await persistDraft(markDraftMintOutcome(latest, { status: 'failed' }));
      await renderCollectionManager();
      setError(message);
      showActionPopup('NFT creation failed', message, 'error');
      hideActionPopup(2200);
      return;
    }

    await renderCollectionManager();
    setError(
      `${message} Mint may already have been submitted. Do not mint this item again. Check the explorer.`
    );
    showActionPopup('NFT creation failed', message, 'error');
    hideActionPopup(2200);
  } finally {
    isBusy = false;
  }
}

collectionItemForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const draftId = editingDraftIdInput.value.trim();

  if (!draftId) {
    setError('Use Mint #001 on a prepared item. Each button mints only that item.');
    return;
  }

  void mintCollectionDraftById(draftId);
});

openCollectionButton.addEventListener('click', () => {
  void openCollection(openCollectionMint.value);
});

inspectExistingNftButton.addEventListener('click', async () => {
  if (!activeCollection) {
    return;
  }

  if (!connectedWalletAddress) {
    setError('Connect a wallet before inspecting an existing NFT.');
    return;
  }

  try {
    const inspection = await inspectExistingNftForCollection({
      network: activeCollection.network,
      walletAddress: connectedWalletAddress,
      collectionMint: activeCollection.mint,
      nftMint: existingNftMint.value.trim(),
    });
    existingNftPlan.innerHTML = renderExistingNftPlanMarkup(inspection.plan);
    pendingExistingNftMint = inspection.plan.canAttempt
      ? inspection.nft.mint
      : null;
    addExistingNftButton.disabled = !inspection.plan.canAttempt;
  } catch (error) {
    pendingExistingNftMint = null;
    addExistingNftButton.disabled = true;
    setError(mapErrorToUserMessage(error));
  }
});

addExistingNftButton.addEventListener('click', async () => {
  if (isBusy || !activeCollection || !pendingExistingNftMint || !connectedWallet) {
    return;
  }

  isBusy = true;

  try {
    const ready = await ensureReadyToMint();
    showActionPopup(
      'Add existing NFT',
      'Your wallet will sign collection set/verify. This does not mint a new NFT.',
      'loading'
    );
    const added = await addExistingNftToCollection({
      network: ready.network,
      walletProvider: ready.wallet,
      walletAddress: ready.address,
      collectionMint: activeCollection.mint,
      nftMint: pendingExistingNftMint,
    });
    const snapshot = await fetchExistingNftSnapshot(ready.network, added.mintAddress);
    const numbering = numberingFromCollection(activeCollection);
    const parsedNumber = extractItemNumberFromName(snapshot.name);
    const used = usedNumbersFromDraftsAndMinted(
      mintedNumbers(activeCollection).filter((n) => n !== parsedNumber),
      studioDrafts
    );
    const fallbackNumber = nextStudioItemNumber(used, numbering) ?? numbering.start;
    const itemNumber = parsedNumber ?? fallbackNumber;
    const allocated = canAllocateItemNumber(
      activeCollection.items
        .filter((item) => item.mint !== added.mintAddress)
        .map((item) => item.number),
      itemNumber,
      numbering.plannedCapacity,
      numbering.start
    );
    activeCollection = recordCachedItem(ready.network, activeCollection.mint, {
      mint: added.mintAddress,
      number: allocated.ok ? itemNumber : fallbackNumber,
      verified: true,
    }) ?? activeCollection;
    await persistStudioSnapshot();
    await renderCollectionManager();
    setStatus(`Existing NFT added and verified. ${shortAddress(added.mintAddress)}`);
    showActionPopup('NFT added', 'Existing NFT was verified into the collection.', 'success');
    hideActionPopup(1600);
  } catch (error) {
    console.error(error);
    const message = mapErrorToUserMessage(error);
    setError(message);
    showActionPopup('Add existing NFT failed', message, 'error');
    hideActionPopup(2200);
  } finally {
    isBusy = false;
  }
});

resultPanel.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.id === 'manageCreatedCollection' && activeCollection) {
    void showCollectionManager({ fetchOnChain: true });
  }

  if (target.id === 'backToCollectionManager' && activeCollection) {
    resultPanel.hidden = true;
    void showCollectionManager({ fetchOnChain: true });
  }
});

const copyDonationButton = document.querySelector<HTMLButtonElement>('#copyDonationAddress');
const donationCopyConfirm = document.querySelector<HTMLParagraphElement>('#donationCopyConfirm');

copyDonationButton?.addEventListener('click', async () => {
  const copied = await copyDonationAddress();

  if (copyDonationButton) {
    copyDonationButton.textContent = copied ? 'Copied' : 'Failed';
  }

  if (donationCopyConfirm) {
    donationCopyConfirm.hidden = !copied;
  }

  window.setTimeout(() => {
    if (copyDonationButton) {
      copyDonationButton.textContent = 'Copy address';
    }

    if (donationCopyConfirm) {
      donationCopyConfirm.hidden = true;
    }
  }, 1600);
});

async function tryTrustedAutoReconnect(): Promise<void> {
  const wasConnected = localStorage.getItem('walletConnected');
  const preferredWallet = localStorage.getItem('preferredWallet');

  if (wasConnected !== 'true' || !preferredWallet) {
    return;
  }

  try {
    const available = detectAvailableWallets();
    const walletMatch = available.find((wallet) => wallet.id === preferredWallet);

    if (!walletMatch) {
      return;
    }

    selectedWalletId = walletMatch.id;
    walletSelect.value = selectedWalletId;
    const address = await connectAndNormalizeWalletPublicKey(walletMatch.provider, {
      onlyIfTrusted: true,
    });
    connectedWallet = walletMatch.provider;
    connectedWalletAddress = address;
    updateWalletBox();
    updatePreview();
    refreshManageCollectionLists();
  } catch {
    clearWalletState();
  }
}

function startPage(): void {
  applyDeveloperNetworkControls();
  syncBuilderNav();
  applyBuilderVisibility();
  refreshWalletSelector();
  updateWalletBox();
  updateNetworkStatus();
  updateMainnetWarning();

  updatePreview();
  updateCollectionPreview();
  refreshManageCollectionLists();
  void loadPendingDrafts();
  void tryTrustedAutoReconnect();
}

const unsubscribeWalletChanges = subscribeToWalletChanges(() => {
  refreshWalletSelector();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeWalletChanges();
  });
}

startPage();
