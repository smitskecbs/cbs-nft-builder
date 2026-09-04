export const UPLOAD_AUTH_EXPIRY_SECONDS = 300;

export function buildPinataUploadAuthMessage(
  walletAddress: string,
  issuedAtUnix: number = Math.floor(Date.now() / 1000)
): string {
  const expiresAtUnix = issuedAtUnix + UPLOAD_AUTH_EXPIRY_SECONDS;

  return [
    'Authorize upload for CBS NFT Builder. This does not move tokens or SOL.',
    '',
    'App: CBS NFT Builder',
    'Purpose: Pinata upload',
    `Wallet: ${walletAddress}`,
    `Issued at (unix): ${issuedAtUnix}`,
    `Expires at (unix): ${expiresAtUnix}`,
  ].join('\n');
}
