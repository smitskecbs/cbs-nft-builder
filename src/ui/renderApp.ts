import { CBS_TOOL_URLS } from '../cbsTools';
import {
  NFT_BUILDER_LOGO_PATH,
  SOLANA_LOGOMARK_PATH,
} from '../branding';
import { renderMarketplaceCardsMarkup } from '../marketplaces';
import { renderDonationSectionMarkup } from '../support/donation';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NFT_NAME_LENGTH,
  MAX_NFT_SYMBOL_LENGTH,
} from '../metadata/nftLimits';
import {
  DEFAULT_DIGIT_COUNT,
  DEFAULT_PLANNED_CAPACITY,
  DEFAULT_START_NUMBER,
  MAX_DIGIT_COUNT,
  MAX_PLANNED_CAPACITY,
  MIN_DIGIT_COUNT,
  MIN_PLANNED_CAPACITY,
} from '../collection/constants';

export function renderAppMarkup(): string {
  return `
    <div id="appShell" class="app-shell is-home">
      <header class="app-header">
        <button type="button" class="app-brand" id="homeBrandButton">
          <img
            class="site-logo"
            src="${NFT_BUILDER_LOGO_PATH}"
            alt=""
            width="512"
            height="512"
          />
          <div class="site-brand-copy">
            <p class="site-banner-kicker">CBS Tool</p>
            <h1 class="site-title">CBS NFT Builder</h1>
          </div>
        </button>

        <div class="app-header-session" aria-label="Network and wallet">
          <div class="network-panel">
            <span id="networkBadge" class="network-badge" data-tone="mainnet">Solana Mainnet</span>
            <div id="developerNetworkControls" class="developer-network-controls" hidden>
              <label class="network-panel-label" for="networkSelect">Developer network</label>
              <select id="networkSelect" class="network-select">
                <option value="mainnet" selected>Mainnet</option>
                <option value="devnet">Devnet</option>
              </select>
            </div>
            <div id="networkStatus" class="network-status visually-hidden" role="status" aria-live="polite"></div>
          </div>

          <div class="wallet-panel">
            <label id="walletSelectLabel" class="visually-hidden" for="walletSelect">Choose wallet</label>
            <p id="walletDetectedHint" class="wallet-detected-hint" hidden></p>
            <select id="walletSelect" aria-labelledby="walletSelectLabel"></select>
            <div class="wallet-panel-actions">
              <button id="connectWallet" type="button" class="primary-btn">
                Connect wallet
              </button>
              <button id="disconnectWallet" type="button" class="secondary-btn">
                Disconnect
              </button>
            </div>
          </div>
          <div id="walletBox" class="wallet-box" role="status" aria-live="polite">
            No wallet connected
          </div>
        </div>
      </header>
      <div id="mainnetNetworkWarning" class="warning-box" hidden></div>

      <section class="page-section primary-nav" aria-labelledby="asset-type-title">
        <h2 class="section-title" id="asset-type-title">What do you want to create?</h2>
        <div class="asset-type-grid" role="radiogroup" aria-labelledby="asset-type-title">
          <button
            type="button"
            class="asset-type-card"
            data-asset-type="nft"
            aria-pressed="false"
          >
            <strong>Create NFT</strong>
            <span>Mint one standalone NFT</span>
          </button>
          <button
            type="button"
            class="asset-type-card"
            data-asset-type="create-collection"
            aria-pressed="false"
          >
            <strong>Create Collection</strong>
            <span>Start a new NFT collection</span>
          </button>
          <button
            type="button"
            class="asset-type-card"
            data-asset-type="manage-collection"
            aria-pressed="false"
          >
            <strong>Manage Collection</strong>
            <span>Continue an existing collection</span>
          </button>
        </div>
        <p class="home-kicker">
          Create unique
          <img
            class="solana-logomark"
            src="${SOLANA_LOGOMARK_PATH}"
            alt=""
            width="16"
            height="12"
          />
          Solana NFTs. You only pay network fees.
        </p>
        <details class="education-details">
          <summary>What is an NFT, a collection, and a token?</summary>
          <ul class="education-list">
            <li>
              <strong>NFT</strong>
              One unique digital item with its own artwork and name.
            </li>
            <li>
              <strong>Collection</strong>
              A cover for a group of NFTs. You create the cover first, then add items.
            </li>
            <li>
              <strong>Token</strong>
              Interchangeable units such as a coin. Use CBS Token Builder for that.
            </li>
          </ul>
          <p class="sft-soon-note">SFT (multiple identical copies) — coming soon.</p>
          <p class="token-builder-hint">
            Need a fungible token or coin?
            Use the
            <a href="${CBS_TOOL_URLS.tokenBuilder}" target="_blank" rel="noopener noreferrer">
              CBS Token Builder
            </a>.
          </p>
        </details>
      </section>

      <form id="nftForm" class="hero-card page-section token-form" hidden novalidate>
        <h2>Create NFT</h2>
        <p class="helper-text">
          Create one unique NFT. This is not a coin or a collection cover.
        </p>

        <fieldset class="form-group form-group-artwork">
          <legend>Artwork</legend>
          <label for="artworkInput">
            <span class="visually-hidden">Artwork file</span>
            <input
              id="artworkInput"
              name="artwork"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              required
            />
          </label>
          <p class="helper-text">PNG, JPEG, WebP, or GIF. Maximum 2 MB.</p>
          <img id="artworkPreview" class="image-preview" alt="Artwork preview" hidden />
        </fieldset>

        <fieldset class="form-group">
          <legend>Details</legend>
          <label for="nftName">
            Name
            <input
              id="nftName"
              name="name"
              type="text"
              maxlength="${MAX_NFT_NAME_LENGTH}"
              autocomplete="off"
              required
            />
          </label>

          <label for="nftDescription">
            Description
            <textarea
              id="nftDescription"
              name="description"
              rows="4"
              maxlength="${MAX_DESCRIPTION_LENGTH}"
            ></textarea>
          </label>
        </fieldset>

        <fieldset class="attribute-fieldset form-group">
          <legend>Traits (optional)</legend>
          <p class="helper-text">Optional. Add a trait such as Background or Edition only if you want one.</p>
          <div id="attributeRows" class="attribute-rows"></div>
          <button id="addAttribute" type="button" class="secondary-btn">
            Add trait
          </button>
        </fieldset>

        <details class="advanced-details form-group-secondary">
          <summary>Advanced</summary>
          <label for="nftSymbol">
            Short label (optional)
            <input
              id="nftSymbol"
              name="symbol"
              type="text"
              maxlength="${MAX_NFT_SYMBOL_LENGTH}"
              autocomplete="off"
            />
          </label>
          <p class="helper-text">Optional. Up to ${MAX_NFT_SYMBOL_LENGTH} characters.</p>

          <label for="nftExternalUrl">
            Website for this NFT (optional)
            <input
              id="nftExternalUrl"
              name="externalUrl"
              type="url"
              placeholder="https://"
              autocomplete="off"
            />
          </label>
          <p class="helper-text">Optional project or artwork page.</p>

          <label for="nftRoyalty">
            Royalty % you earn on later sales
            <input
              id="nftRoyalty"
              name="royalty"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value="0"
            />
          </label>
          <p class="helper-text">
            0% royalty is fine. The connected wallet is the only creator.
          </p>

          <label class="checkbox-row">
            <input id="nftMutable" type="checkbox" checked />
            Keep editable after mint
          </label>
          <p id="mutableHelp" class="helper-text">
            On: you can update this NFT’s details later from the same wallet.
            Off: details stay fixed after minting.
          </p>
        </details>

        <div id="nftPreview" class="preview-panel" aria-live="polite"></div>

        <button id="createNftButton" type="submit" class="primary-btn mint-action-btn">
          Create this NFT
        </button>
      </form>

      <form id="collectionForm" class="hero-card page-section token-form" hidden novalidate>
        <h2>Create Collection</h2>
        <p class="helper-text">
          This creates the cover of your collection. You can add the individual NFTs afterwards.
        </p>
        <label for="collectionArtworkInput">
          Collection image
          <input
            id="collectionArtworkInput"
            name="collectionArtwork"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
            required
          />
        </label>
        <p class="helper-text">PNG, JPEG, WebP, or GIF. Maximum 2 MB.</p>
        <img id="collectionArtworkPreview" class="image-preview" alt="Collection artwork preview" hidden />

        <label for="collectionName">
          Collection name
          <input
            id="collectionName"
            name="collectionName"
            type="text"
            maxlength="${MAX_NFT_NAME_LENGTH}"
            autocomplete="off"
            required
          />
        </label>

        <label for="collectionDescription">
          Description
          <textarea
            id="collectionDescription"
            name="collectionDescription"
            rows="4"
            maxlength="${MAX_DESCRIPTION_LENGTH}"
          ></textarea>
        </label>

        <details class="advanced-details">
          <summary>Advanced</summary>
          <label for="collectionSymbol">
            Symbol
            <input
              id="collectionSymbol"
              name="collectionSymbol"
              type="text"
              maxlength="${MAX_NFT_SYMBOL_LENGTH}"
              autocomplete="off"
            />
          </label>

          <label for="collectionExternalUrl">
            External URL
            <input
              id="collectionExternalUrl"
              name="collectionExternalUrl"
              type="url"
              autocomplete="off"
            />
          </label>

          <label for="collectionRoyalty">
            Creator royalty percent
            <input
              id="collectionRoyalty"
              name="collectionRoyalty"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value="0"
            />
          </label>

          <label class="checkbox-row">
            <input id="collectionMutable" type="checkbox" checked />
            Allow updates later
          </label>

          <fieldset class="studio-fieldset">
            <legend>Item naming defaults</legend>
            <p class="helper-text">
              Used later when you add NFTs to this collection. You can change unique details per item.
            </p>
            <label for="collectionItemBaseName">
              Item base name
              <input
                id="collectionItemBaseName"
                type="text"
                maxlength="${MAX_NFT_NAME_LENGTH}"
                placeholder="Derived from the collection name"
                autocomplete="off"
              />
            </label>
            <p class="helper-text">
              Leave empty to use the collection name without the word Collection.
            </p>
            <div class="studio-numbering-grid">
              <label for="collectionDigitCount">
                Number digits
                <input
                  id="collectionDigitCount"
                  type="number"
                  min="${MIN_DIGIT_COUNT}"
                  max="${MAX_DIGIT_COUNT}"
                  value="${DEFAULT_DIGIT_COUNT}"
                />
              </label>
              <label for="collectionStartNumber">
                Start
                <input
                  id="collectionStartNumber"
                  type="number"
                  min="1"
                  value="${DEFAULT_START_NUMBER}"
                />
              </label>
              <label for="collectionPlannedCapacity">
                Planned size
                <input
                  id="collectionPlannedCapacity"
                  type="number"
                  min="${MIN_PLANNED_CAPACITY}"
                  max="${MAX_PLANNED_CAPACITY}"
                  value="${DEFAULT_PLANNED_CAPACITY}"
                />
              </label>
            </div>
            <div id="collectionNumberingPreview"></div>
            <p class="helper-text">
              Planned size is a local target for names and progress. It is not a blockchain limit.
            </p>
            <fieldset class="attribute-fieldset">
              <legend>Shared traits</legend>
              <p class="helper-text">Optional traits inherited by every draft unless you change them.</p>
              <div id="collectionDefaultAttributeRows" class="attribute-rows"></div>
              <button id="addCollectionDefaultAttribute" type="button" class="secondary-btn">
                Add shared trait
              </button>
            </fieldset>
          </fieldset>

          <fieldset class="studio-fieldset">
            <legend>Prepare items later or now</legend>
            <p class="helper-text">
              Optional. Select images to create local drafts. Nothing is uploaded or minted until you mint one item.
            </p>
            <div id="pendingDraftDropzone" class="studio-dropzone">
              <p>Drop PNG, JPEG, WebP, or GIF files here, or select multiple images.</p>
              <input
                id="pendingDraftArtworkInput"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              />
              <button id="pendingDraftFolderButton" type="button" class="secondary-btn">
                Import folder
              </button>
              <input id="pendingDraftFolderInput" type="file" multiple hidden />
            </div>
            <div id="pendingDraftList" class="studio-draft-list"></div>
          </fieldset>
        </details>

        <div id="collectionPreview" class="preview-panel" aria-live="polite"></div>

        <button id="createCollectionButton" type="submit" class="primary-btn">
          Review and create collection
        </button>
      </form>

      <section id="recentCollectionsSection" class="hero-card page-section open-collection-card" hidden>
        <h2 class="cbs-overview-title">Manage Collection</h2>

        <div id="yourCollectionsSection" class="manage-block">
          <h3>Your collections</h3>
          <p id="yourCollectionsStatus" class="helper-text">
            Connect your wallet to find collections you manage, or paste a collection address below.
          </p>
          <div id="yourCollectionsList" class="your-collections nft-gallery"></div>
        </div>

        <div id="openAnotherCollectionSection" class="manage-block">
          <h3>Open another collection</h3>
          <p class="helper-text">
            Paste a collection address. Use the same network it was created on.
          </p>
          <label for="openCollectionMint">
            Collection address
            <input id="openCollectionMint" type="text" autocomplete="off" spellcheck="false" />
          </label>
          <button id="openCollectionButton" type="button" class="primary-btn">
            Open collection
          </button>
        </div>

        <div id="recentCollectionsBlock" class="manage-block" hidden>
          <h3>Recent collections</h3>
          <p class="helper-text">
            Collections you opened earlier on this device. They are not opened automatically.
          </p>
          <div id="recentCollectionsList" class="recent-collections"></div>
        </div>
      </section>

      <section id="collectionManager" class="studio-shell page-section" hidden>
        <div id="collectionManagerSummary"></div>
        <div id="studioGallery" class="studio-gallery">
          <div id="studioDraftList" class="nft-gallery"></div>
        </div>
        <form id="collectionItemForm" class="token-form create-next-nft-form" hidden novalidate>
          <button id="backToCollectionButton" type="button" class="ghost-btn back-to-collection-btn">
            ← Back to collection
          </button>
          <h3 id="collectionItemEditorTitle" tabindex="-1">Create next NFT</h3>
          <p class="helper-text">
            Artwork, name, description, and optional traits. Number, symbol, royalty, and editability come from this collection.
            Saving a draft does not mint or upload.
          </p>
          <p id="collectionNextNumber" class="helper-text"></p>
          <input id="editingDraftId" type="hidden" value="" />
          <input id="collectionItemSymbol" type="hidden" />
          <input id="collectionItemRoyalty" type="hidden" value="0" />
          <input id="collectionItemMutable" type="checkbox" checked hidden />
          <fieldset class="form-group form-group-artwork">
            <legend>Artwork</legend>
            <label for="collectionItemArtworkInput">
              <span class="visually-hidden">Artwork file</span>
              <input
                id="collectionItemArtworkInput"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              />
            </label>
            <img id="collectionItemArtworkPreview" class="image-preview" alt="Item artwork preview" hidden />
          </fieldset>
          <fieldset class="form-group">
            <legend>Details</legend>
            <label for="collectionItemName">
              Name
              <input id="collectionItemName" type="text" maxlength="${MAX_NFT_NAME_LENGTH}" autocomplete="off" required />
            </label>
            <label for="collectionItemDescription">
              Description
              <textarea id="collectionItemDescription" rows="6" maxlength="${MAX_DESCRIPTION_LENGTH}"></textarea>
            </label>
          </fieldset>
          <fieldset class="attribute-fieldset form-group">
            <legend>Traits (optional)</legend>
            <p class="helper-text">Optional. Add a trait only if you want one. Completely empty rows are ignored.</p>
            <div id="collectionItemAttributeRows" class="attribute-rows"></div>
            <button id="addCollectionItemAttribute" type="button" class="secondary-btn">
              Add trait
            </button>
          </fieldset>
          <details class="advanced-details form-group-secondary">
            <summary>Advanced</summary>
            <p class="helper-text">Website is saved on this draft. Symbol, royalty, and editability use collection defaults and are not per-item mint overrides.</p>
            <label for="collectionItemExternalUrl">
              Website for this NFT (optional)
              <input id="collectionItemExternalUrl" type="url" autocomplete="off" />
            </label>
          </details>
          <div class="form-actions wallet-panel-actions">
            <button id="saveDraftButton" type="button" class="secondary-btn">
              Save draft
            </button>
            <button id="createCollectionItemButton" type="submit" class="primary-btn mint-action-btn">
              Mint this item
            </button>
          </div>
          <p class="helper-text">Mint saves the current form first, then asks your wallet to sign. Save draft keeps a local copy without minting. Minting is one item at a time. There is no Mint all action.</p>
        </form>
        <details id="studioAdvancedDetails" class="advanced-details studio-advanced">
          <summary>Advanced details</summary>
          <fieldset class="studio-fieldset">
            <legend>Import more artwork</legend>
            <p class="helper-text">
              Import creates local drafts only. Mint one prepared item at a time. There is no Mint all action.
            </p>
            <div id="studioDraftDropzone" class="studio-dropzone">
              <p>Drop images or a folder here. PNG, JPEG, WebP, or GIF. Maximum 2 MB each.</p>
              <input
                id="studioArtworkInput"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              />
              <button id="studioFolderButton" type="button" class="secondary-btn">
                Import folder
              </button>
              <input id="studioFolderInput" type="file" multiple hidden />
            </div>
            <p id="studioImportStatus" class="helper-text"></p>
          </fieldset>
          <div class="existing-nft-panel">
            <h3>Add existing NFT</h3>
            <p class="helper-text">
              Use this for an NFT that already exists. This does not mint a new NFT.
            </p>
            <label for="existingNftMint">
              Mint address
              <input id="existingNftMint" type="text" autocomplete="off" />
            </label>
            <div class="wallet-panel-actions">
              <button id="inspectExistingNftButton" type="button" class="secondary-btn">
                Inspect existing NFT
              </button>
              <button id="addExistingNftButton" type="button" class="primary-btn" disabled>
                Add existing NFT
              </button>
            </div>
            <div id="existingNftPlan" class="preview-panel"></div>
          </div>
        </details>
      </section>


      <div id="nftStatus" class="app-status" role="status" aria-live="polite"></div>

      <div id="nftResult" class="hero-card page-section result-panel" hidden></div>

      <details class="education-details footer-extras">
        <summary>Marketplaces and support</summary>
        ${renderMarketplaceCardsMarkup()}
        ${renderDonationSectionMarkup()}
      </details>

      <footer class="cbs-site-footer site-footer">
        <div class="cbs-footer-inner">
          <nav class="cbs-footer-links" aria-label="CBS ecosystem links">
            <a href="${CBS_TOOL_URLS.toolsHub}" target="_blank" rel="noopener noreferrer">CBS Tools</a>
            <a href="${CBS_TOOL_URLS.cbsCoin}" target="_blank" rel="noopener noreferrer">CBS Coin</a>
            <a href="${CBS_TOOL_URLS.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
          <p class="cbs-footer-tagline">
            CBS never receives your private key. Your wallet signs every transaction.
          </p>
        </div>
      </footer>

      <div id="itemEditorOverlay" class="item-editor-overlay" hidden>
        <div class="item-editor-panel" role="dialog" aria-modal="true" aria-labelledby="itemEditorTitle">
          <h2 id="itemEditorTitle">Edit item</h2>
          <p class="helper-text">
            Item overrides apply only to this draft. Collection Studio defaults and other drafts stay unchanged.
            Save item does not upload, mint, or open a wallet.
          </p>
          <div id="itemEditorDefaults"></div>
          <img id="itemEditorArtworkPreview" class="image-preview" alt="Item artwork preview" hidden />
          <p id="itemEditorArtworkName" class="helper-text"></p>
          <section class="item-editor-overrides">
            <h3>Item overrides</h3>
            <label for="itemEditorName">
              Name
              <input id="itemEditorName" type="text" maxlength="${MAX_NFT_NAME_LENGTH}" autocomplete="off" />
            </label>
            <p id="itemEditorNameSource" class="helper-text">Collection Studio default</p>
            <label for="itemEditorDescription">
              Description
              <textarea id="itemEditorDescription" rows="8" maxlength="${MAX_DESCRIPTION_LENGTH}"></textarea>
            </label>
            <p id="itemEditorDescriptionSource" class="helper-text">Collection Studio default</p>
            <label for="itemEditorExternalUrl">
              External URL
              <input id="itemEditorExternalUrl" type="url" autocomplete="off" />
            </label>
            <p id="itemEditorExternalUrlSource" class="helper-text">Collection Studio default</p>
            <fieldset class="attribute-fieldset">
              <legend>Attributes</legend>
              <p id="itemEditorAttributesSource" class="helper-text">Collection Studio default</p>
              <div id="itemEditorAttributeRows" class="attribute-rows"></div>
              <button id="itemEditorAddAttribute" type="button" class="secondary-btn">
                Add attribute
              </button>
            </fieldset>
          </section>
          <div id="itemEditorPreview" class="preview-panel" aria-live="polite"></div>
          <div class="wallet-panel-actions">
            <button id="itemEditorSave" type="button" class="primary-btn">Save item</button>
            <button id="itemEditorCancel" type="button" class="secondary-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
