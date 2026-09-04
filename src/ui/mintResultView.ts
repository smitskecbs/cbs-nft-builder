import { getExplorerNftUrl, getExplorerTxUrl } from '../solana/explorer';
import {
  INDEXING_NOTICE,
  NFT_CREATED_HEADING,
  type MintDisplayModel,
} from '../solana/mintResult';
import type { SolanaNetwork } from '../solana/config';
import { renderResultMarketplaceLinksMarkup } from '../marketplaces';
import { escapeHtml } from './html';

export function networkLabelToSolanaNetwork(
  label: MintDisplayModel['networkLabel']
): SolanaNetwork {
  return label === 'Mainnet' ? 'mainnet' : 'devnet';
}

export function renderMintResultMarkup(model: MintDisplayModel): string {
  const network = networkLabelToSolanaNetwork(model.networkLabel);
  const nftUrl = getExplorerNftUrl(network, model.mintAddress);
  const txUrl = getExplorerTxUrl(network, model.signature);
  const artwork = model.artworkPreviewUrl
    ? `<img class="image-preview" src="${escapeHtml(model.artworkPreviewUrl)}" alt="${escapeHtml(model.name)} artwork" />`
    : '';
  const indexing = model.showIndexingNotice
    ? `<p class="helper-text">${escapeHtml(INDEXING_NOTICE)}</p>`
    : '';

  return `
    <h2>${NFT_CREATED_HEADING}</h2>
    ${indexing}
    ${artwork}
    <dl class="preview-list">
      <div><dt>Name</dt><dd>${escapeHtml(model.name)}</dd></div>
      <div><dt>Mint address</dt><dd>${escapeHtml(model.mintAddress)}</dd></div>
      <div><dt>Transaction</dt><dd>${escapeHtml(model.signature)}</dd></div>
      <div><dt>Network</dt><dd>${model.networkLabel}</dd></div>
      <div><dt>Token standard</dt><dd>${model.tokenStandard}</dd></div>
      <div><dt>Metadata URI</dt><dd>${escapeHtml(model.metadataUri)}</dd></div>
    </dl>
    <div class="result-actions">
      <a class="primary-btn" href="${escapeHtml(nftUrl)}" target="_blank" rel="noopener noreferrer">View NFT on Solscan</a>
      <a class="secondary-btn" href="${escapeHtml(txUrl)}" target="_blank" rel="noopener noreferrer">View transaction on Solscan</a>
      <button type="button" class="secondary-btn" id="copyMintAddress">Copy mint address</button>
      <button type="button" class="secondary-btn" id="replayMintResult">Show this result again</button>
      <button type="button" class="secondary-btn" id="createAnotherNft">Create another NFT</button>
    </div>
    ${renderResultMarketplaceLinksMarkup()}
  `;
}
