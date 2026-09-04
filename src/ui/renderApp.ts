import { CBS_TOOL_URLS } from '../cbsTools';
import {
  NFT_BUILDER_BANNER_PATH,
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
  DEFAULT_COLLECTION_EXTERNAL_URL,
  DEFAULT_COLLECTION_ITEM_PREFIX,
  DEFAULT_COLLECTION_SYMBOL,
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
    <div class="app-shell">
      <header class="site-hero">
        <div class="site-brand">
          <img
            class="site-logo"
            src="${NFT_BUILDER_LOGO_PATH}"
            alt="CBS NFT Builder logo"
            width="512"
            height="512"
          />
          <div class="site-brand-copy">
            <p class="site-banner-kicker">CBS Tool</p>
            <h1 class="site-title">CBS NFT Builder</h1>
          </div>
        </div>
        <img
          class="site-banner"
          src="${NFT_BUILDER_BANNER_PATH}"
          alt="CBS NFT Builder"
          width="1600"
          height="450"
        />
        <p class="site-hero-subtitle">
          Create unique
          <img
            class="solana-logomark"
            src="${SOLANA_LOGOMARK_PATH}"
            alt=""
            width="16"
            height="12"
          />
          Solana NFTs with simple, beginner-friendly tools.
        </p>
        <div class="community-message" aria-labelledby="community-message-heading">
          <div class="community-message-panel">
            <h2 class="community-message-title" id="community-message-heading">
              Built for the Solana Community
            </h2>
            <p class="community-message-body">
              CBS NFT Builder is free to use.
              You only pay Solana network fees and optional third-party service fees.
            </p>
          </div>
        </div>
      </header>

      <section class="page-section primary-nav" aria-labelledby="asset-type-title">
        <h2 class="section-title" id="asset-type-title">What do you want to do?</h2>
        <div class="asset-type-grid" role="radiogroup" aria-labelledby="asset-type-title">
          <button
            type="button"
            class="asset-type-card is-active"
            data-asset-type="nft"
            aria-pressed="true"
          >
            <span class="asset-type-emoji" aria-hidden="true">🖼</span>
            <strong>Create NFT</strong>
            <span>Create one unique NFT.</span>
          </button>
          <button
            type="button"
            class="asset-type-card"
            data-asset-type="create-collection"
            aria-pressed="false"
          >
            <span class="asset-type-emoji" aria-hidden="true">🗂</span>
            <strong>Create Collection</strong>
            <span>Create the cover and identity for a new NFT collection.</span>
          </button>
          <button
            type="button"
            class="asset-type-card"
            data-asset-type="manage-collection"
            aria-pressed="false"
          >
            <span class="asset-type-emoji" aria-hidden="true">📂</span>
            <strong>Manage Collection</strong>
            <span>Open an existing collection, create items, manage drafts or attach an existing NFT.</span>
          </button>
        </div>
        <p class="sft-soon-note">SFT (multiple identical copies) — coming soon.</p>
        <p class="token-builder-hint">
          Need a fungible token or coin?
          Use the
          <a href="${CBS_TOOL_URLS.tokenBuilder}" target="_blank" rel="noopener noreferrer">
            CBS Token Builder
          </a>.
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
        </details>
      </section>

      <section class="hero-card page-section session-bar" aria-label="Network and wallet">
        <div class="network-panel">
          <label class="network-panel-label" for="networkSelect">Network</label>
          <select id="networkSelect" class="network-select">
            <option value="devnet" selected>Devnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
          <div id="networkStatus" class="network-status" role="status" aria-live="polite"></div>
        </div>
        <div id="mainnetNetworkWarning" class="warning-box" hidden></div>

        <div class="wallet-panel">
          <label id="walletSelectLabel" for="walletSelect">Choose wallet</label>
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
      </section>

      <form id="nftForm" class="hero-card page-section token-form" novalidate>
        <h2>Create NFT</h2>
        <p class="helper-text">
          Create one unique NFT. This is not a coin or a collection cover.
        </p>

        <label for="artworkInput">
          Artwork
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

        <fieldset class="attribute-fieldset">
          <legend>Traits</legend>
          <p class="helper-text">Optional traits such as Background or Edition.</p>
          <div id="attributeRows" class="attribute-rows"></div>
          <button id="addAttribute" type="button" class="secondary-btn">
            Add trait
          </button>
        </fieldset>

        <details class="advanced-details">
          <summary>Advanced</summary>
          <label for="nftSymbol">
            Symbol
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
            External URL
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
            Creator royalty percent
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
            Optional. 0% by default. The connected wallet is the only creator.
          </p>

          <label class="checkbox-row">
            <input id="nftMutable" type="checkbox" checked />
            Allow updates later
          </label>
          <p id="mutableHelp" class="helper-text">
            On: you can update this NFT’s details later from the same wallet.
            Off: details stay fixed after minting.
          </p>
        </details>

        <div id="nftPreview" class="preview-panel" aria-live="polite"></div>

        <button id="createNftButton" type="submit" class="primary-btn">
          Review and create NFT
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
              value="${DEFAULT_COLLECTION_SYMBOL}"
              autocomplete="off"
            />
          </label>

          <label for="collectionExternalUrl">
            External URL
            <input
              id="collectionExternalUrl"
              name="collectionExternalUrl"
              type="url"
              value="${DEFAULT_COLLECTION_EXTERNAL_URL}"
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
                value="${DEFAULT_COLLECTION_ITEM_PREFIX}"
                autocomplete="off"
              />
            </label>
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

      <section id="recentCollectionsSection" class="cbs-overview-card page-section" hidden>
        <h2 class="cbs-overview-title">Open a collection</h2>
        <p class="helper-text">
          Choose a collection you created earlier, or paste its address.
          Use the same network it was created on (Devnet or Mainnet).
        </p>
        <div id="recentCollectionsList" class="recent-collections"></div>
        <label for="openCollectionMint">
          Open collection mint
          <input id="openCollectionMint" type="text" autocomplete="off" />
        </label>
        <button id="openCollectionButton" type="button" class="secondary-btn">
          Fetch collection on-chain
        </button>
      </section>

      <section id="collectionManager" class="hero-card page-section" hidden>
        <div id="collectionManagerSummary"></div>
        <div id="studioDraftList" class="studio-draft-list"></div>
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
        <form id="collectionItemForm" class="token-form" novalidate>
          <h3>Mint one item</h3>
          <p class="helper-text">
            Use Edit item on a draft to set a unique name, description, URL, and traits.
            Saving item edits does not mint or upload.
          </p>
          <p id="collectionNextNumber" class="helper-text"></p>
          <input id="editingDraftId" type="hidden" value="" />
          <label for="collectionItemArtworkInput">
            Artwork
            <input
              id="collectionItemArtworkInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
            />
          </label>
          <img id="collectionItemArtworkPreview" class="image-preview" alt="Item artwork preview" hidden />
          <label for="collectionItemName">
            Name
            <input id="collectionItemName" type="text" maxlength="${MAX_NFT_NAME_LENGTH}" autocomplete="off" required />
          </label>
          <label for="collectionItemSymbol">
            Symbol
            <input id="collectionItemSymbol" type="text" maxlength="${MAX_NFT_SYMBOL_LENGTH}" autocomplete="off" />
          </label>
          <label for="collectionItemDescription">
            Description
            <textarea id="collectionItemDescription" rows="6" maxlength="${MAX_DESCRIPTION_LENGTH}"></textarea>
          </label>
          <label for="collectionItemExternalUrl">
            External URL
            <input id="collectionItemExternalUrl" type="url" autocomplete="off" />
          </label>
          <label for="collectionItemRoyalty">
            Royalty percent
            <input id="collectionItemRoyalty" type="number" min="0" max="100" step="0.01" value="0" />
          </label>
          <label class="checkbox-row">
            <input id="collectionItemMutable" type="checkbox" checked />
            Metadata can be updated later
          </label>
          <fieldset class="attribute-fieldset">
            <legend>Attributes</legend>
            <p class="helper-text">Shown from the selected draft. Use Edit item to change unique traits without minting.</p>
            <div id="collectionItemAttributeRows" class="attribute-rows"></div>
            <button id="addCollectionItemAttribute" type="button" class="secondary-btn">
              Add attribute
            </button>
          </fieldset>
          <div class="wallet-panel-actions">
            <button id="saveDraftButton" type="button" class="secondary-btn">
              Save draft
            </button>
            <button id="createCollectionItemButton" type="submit" class="primary-btn">
              Mint this item
            </button>
          </div>
          <p class="helper-text">Minting is one item at a time. There is no Mint all action.</p>
        </form>
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
      </section>


      <div id="nftStatus" class="wallet-box page-section" role="status" aria-live="polite">
        NFT status will appear here
      </div>

      <div id="nftResult" class="hero-card page-section result-panel" hidden></div>

      ${renderMarketplaceCardsMarkup()}

      ${renderDonationSectionMarkup()}

      <footer class="cbs-site-footer site-footer">
        <div class="cbs-footer-inner">
          <nav class="cbs-footer-links" aria-label="CBS ecosystem links">
            <a href="${CBS_TOOL_URLS.toolsHub}" target="_blank" rel="noopener noreferrer">CBS Tools</a>
            <a href="${CBS_TOOL_URLS.cbsCoin}" target="_blank" rel="noopener noreferrer">CBS Coin</a>
            <a href="${CBS_TOOL_URLS.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
          <div class="cbs-footer-open">
            <h3 class="cbs-footer-open-title">Built in the Open</h3>
            <p class="cbs-footer-open-text">
              CBS Tools is developed publicly and transparently.
              Source code, improvements and community contributions can be followed on GitHub.
            </p>
          </div>
          <p class="cbs-footer-badges">
            Open Source • Community Driven • Built on Solana
          </p>
          <p class="cbs-footer-tagline">
            Community-built tools for Solana builders.
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
