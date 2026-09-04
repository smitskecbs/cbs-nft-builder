import { escapeHtml, shortAddress } from './html';
import type { ValidatedUniqueNftForm } from '../validation/nftForm';
import type { SolanaNetwork } from '../solana/config';

export type PreviewModel = ValidatedUniqueNftForm & {
  network: SolanaNetwork;
  artworkPreviewUrl: string | null;
  metadataUri?: string;
};

export function renderPreviewMarkup(model: PreviewModel): string {
  const attributes =
    model.attributes.length === 0
      ? '<p class="preview-empty">No attributes</p>'
      : `<ul class="preview-attributes">${model.attributes
          .map(
            (attribute) =>
              `<li><strong>${escapeHtml(attribute.trait_type)}</strong> ${escapeHtml(attribute.value)}</li>`
          )
          .join('')}</ul>`;

  const artwork = model.artworkPreviewUrl
    ? `<img class="image-preview" src="${escapeHtml(model.artworkPreviewUrl)}" alt="Artwork preview" />`
    : '';

  const metadataLine = model.metadataUri
    ? `<div><dt>Metadata</dt><dd>${escapeHtml(model.metadataUri)}</dd></div>`
    : '';

  const mutableLine = model.isMutable
    ? 'You can update this NFT’s details later from the same wallet.'
    : 'Details stay fixed after minting.';

  return `
    <h3>Preview</h3>
    ${artwork}
    <dl class="preview-list">
      <div><dt>What you are creating</dt><dd>Unique NFT</dd></div>
      <div><dt>Name</dt><dd>${escapeHtml(model.name)}</dd></div>
      <div><dt>Symbol</dt><dd>${escapeHtml(model.symbol || '—')}</dd></div>
      <div><dt>Description</dt><dd>${escapeHtml(model.description || '—')}</dd></div>
      <div><dt>Traits</dt><dd>${attributes}</dd></div>
      <div><dt>Creator</dt><dd>${escapeHtml(shortAddress(model.creatorAddress))}</dd></div>
      <div><dt>Royalty</dt><dd>${escapeHtml(String(model.royaltyPercent))}%</dd></div>
      ${metadataLine}
      <div><dt>Network</dt><dd>${model.network === 'mainnet' ? 'Mainnet' : 'Devnet'}</dd></div>
      <div><dt>Updates</dt><dd>${escapeHtml(mutableLine)}</dd></div>
    </dl>
    <p class="helper-text">
      CBS never receives your private key.
      Your wallet signs the mint transaction.
    </p>
  `;
}
