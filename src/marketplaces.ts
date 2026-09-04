export type NftMarketplace = {
  id: string;
  name: string;
  description: string;
  url: string;
  visitLabel: string;
  logoAlt: string;
  /**
   * Local official logo path once a verified platform asset is added.
   * Null until an official file is obtained — do not invent a substitute.
   */
  logoPath: string | null;
  expectedLogoPath: string;
};

export const NFT_MARKETPLACES: readonly NftMarketplace[] = [
  {
    id: 'magic-eden',
    name: 'Magic Eden',
    description: 'Solana NFT Marketplace',
    url: 'https://magiceden.io/',
    visitLabel: 'Visit Magic Eden',
    logoAlt: 'Magic Eden',
    logoPath: null,
    expectedLogoPath: '/marketplaces/magic-eden-logo.svg',
  },
  {
    id: 'tensor',
    name: 'Tensor',
    description: 'Solana NFT Marketplace',
    url: 'https://www.tensor.trade/',
    visitLabel: 'Visit Tensor',
    logoAlt: 'Tensor',
    logoPath: null,
    expectedLogoPath: '/marketplaces/tensor-logo.svg',
  },
];

export const MARKETPLACE_EXTERNAL_REL = 'noopener noreferrer';

export const MARKETPLACE_DISCLAIMER =
  'Creating an NFT does not automatically list it for sale. Marketplace discovery and listing are handled separately by each marketplace.';

export const MARKETPLACE_INDEXING_NOTE =
  'Wallets and marketplaces may need time to index a newly created NFT.';

function renderMarketplaceLogo(marketplace: NftMarketplace, sizeClass: string): string {
  if (!marketplace.logoPath) {
    return '';
  }

  return `
    <span class="${sizeClass}">
      <img
        src="${marketplace.logoPath}"
        alt="${marketplace.logoAlt}"
        width="96"
        height="96"
      />
    </span>
  `;
}

export function renderMarketplaceCardsMarkup(): string {
  const cards = NFT_MARKETPLACES.map(
    (marketplace) => `
      <a
        class="marketplace-card"
        href="${marketplace.url}"
        target="_blank"
        rel="${MARKETPLACE_EXTERNAL_REL}"
      >
        ${renderMarketplaceLogo(marketplace, 'marketplace-logo')}
        <strong>${marketplace.name}</strong>
        <span class="marketplace-description">${marketplace.description}</span>
        <span class="marketplace-visit">${marketplace.visitLabel}</span>
      </a>
    `
  ).join('');

  return `
    <section class="cbs-overview-card page-section" aria-labelledby="marketplace-title">
      <h2 class="cbs-overview-title" id="marketplace-title">
        Explore NFT Marketplaces
      </h2>
      <p class="helper-text">
        ${MARKETPLACE_DISCLAIMER}
      </p>
      <p class="helper-text">
        ${MARKETPLACE_INDEXING_NOTE}
      </p>
      <div class="marketplace-grid">
        ${cards}
      </div>
    </section>
  `;
}

export function renderResultMarketplaceLinksMarkup(): string {
  const links = NFT_MARKETPLACES.map(
    (marketplace) => `
      <a
        class="secondary-btn result-marketplace-link"
        href="${marketplace.url}"
        target="_blank"
        rel="${MARKETPLACE_EXTERNAL_REL}"
      >
        ${renderMarketplaceLogo(marketplace, 'marketplace-logo marketplace-logo--compact')}
        ${marketplace.visitLabel}
      </a>
    `
  ).join('');

  return `
    <div class="whats-next">
      <h3>What's next?</h3>
      <p class="helper-text">
        ${MARKETPLACE_DISCLAIMER}
      </p>
      <p class="helper-text">
        ${MARKETPLACE_INDEXING_NOTE}
        These links open the marketplace homepage, not a guaranteed item page for this mint.
      </p>
      <div class="result-actions">
        ${links}
      </div>
    </div>
  `;
}
