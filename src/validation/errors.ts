export const LOCAL_UPLOAD_SERVICE_UNAVAILABLE_MESSAGE =
  'Artwork upload failed because the local upload service became unavailable. Please restart the NFT Builder and try again.';

export const LOCAL_UPLOAD_SERVICE_UNAVAILABLE_BEFORE_MINT_MESSAGE =
  'Artwork upload failed because the local upload service became unavailable. Nothing was minted. Please restart the NFT Builder and try again.';

export function isLocalUploadServiceUnavailableError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();

  return (
    message === LOCAL_UPLOAD_SERVICE_UNAVAILABLE_MESSAGE ||
    message === LOCAL_UPLOAD_SERVICE_UNAVAILABLE_BEFORE_MINT_MESSAGE ||
    lower.includes('local upload service became unavailable')
  );
}

export function mapErrorToUserMessage(
  error: unknown,
  options: { mintTransactionSubmitted?: boolean } = {}
): string {
  const message =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const lower = message.toLowerCase();

  if (isLocalUploadServiceUnavailableError(error)) {
    return options.mintTransactionSubmitted
      ? LOCAL_UPLOAD_SERVICE_UNAVAILABLE_MESSAGE
      : LOCAL_UPLOAD_SERVICE_UNAVAILABLE_BEFORE_MINT_MESSAGE;
  }

  if (
    lower.includes('user rejected') ||
    lower.includes('user declined') ||
    lower.includes('rejected the request') ||
    lower.includes('request rejected') ||
    lower.includes('cancelled') ||
    lower.includes('canceled') ||
    lower.includes('4001')
  ) {
    return 'Wallet request was cancelled.';
  }

  if (
    lower.includes('signmessage') ||
    lower.includes('cannot authorize uploads')
  ) {
    return 'This wallet cannot authorize uploads. Please use Phantom, Solflare, or Backpack.';
  }

  if (
    lower.includes('does not support the required signing') ||
    lower.includes('wallet does not support')
  ) {
    return 'This wallet does not support the required signing method for NFT creation.';
  }

  if (lower.includes('public key could not be read')) {
    return 'Wallet public key could not be read. Please reconnect your wallet.';
  }

  if (lower.includes('connect a wallet')) {
    return 'Connect a wallet before minting.';
  }

  if (lower.includes('too large') || lower.includes('2 mb')) {
    return 'Artwork is too large. The maximum size is 2 MB.';
  }

  if (
    lower.includes('unsupported upload file type') ||
    lower.includes('must be a png')
  ) {
    return 'Artwork must be a PNG, JPEG, WebP, or GIF image.';
  }

  if (lower.includes('pinata') || lower.includes('upload service unavailable')) {
    return 'Artwork or metadata upload failed. Please try again.';
  }

  if (lower.includes('mainnet rpc is not configured')) {
    return 'Mainnet RPC is not configured.';
  }

  if (
    lower.includes('insufficient') ||
    lower.includes('no sol') ||
    lower.includes('0x1') ||
    lower.includes('insufficient funds') ||
    lower.includes('insufficient lamports')
  ) {
    return 'Not enough SOL in this wallet to pay network fees.';
  }

  if (
    lower.includes('simulation failed') ||
    lower.includes('transaction simulation')
  ) {
    return 'The mint transaction could not be simulated. Check the form and try again.';
  }

  if (lower.includes('mint unavailable')) {
    return 'The NFT may already exist in your wallet. Wallets and explorers may need a moment to index it. Check the wallet and Solscan before creating another NFT.';
  }

  if (
    lower.includes('blockhash') ||
    lower.includes('not confirmed') ||
    lower.includes('timed out') ||
    lower.includes('was not confirmed')
  ) {
    return 'The mint transaction was not confirmed. Check Solscan before trying again.';
  }

  if (lower.includes('network') && lower.includes('mismatch')) {
    return message;
  }

  if (message && message.length <= 180 && !lower.includes('at http')) {
    return message;
  }

  return 'Something went wrong. Please try again.';
}
