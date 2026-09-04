import bs58 from 'bs58';

import {
  logUploadAuthorizationWalletDebug,
  prepareProviderForUploadAuth,
  type SolanaWalletProvider,
} from '../solana/wallets';
import { toIpfsUri, toPinataGatewayUrl } from '../metadata/buildNftMetadata';
import type { NftJsonMetadata } from '../metadata/buildNftMetadata';
import {
  buildPinataUploadAuthMessage,
  UPLOAD_AUTH_EXPIRY_SECONDS,
} from './pinataAuth';

export { buildPinataUploadAuthMessage, UPLOAD_AUTH_EXPIRY_SECONDS };

const PINATA_UPLOAD_API =
  import.meta.env.VITE_PINATA_UPLOAD_API?.trim() || '/api/upload-to-pinata';

export const UPLOAD_AUTH_UNSUPPORTED_WALLET_MESSAGE =
  'This wallet cannot authorize uploads. Please use Phantom, Solflare, or Backpack.';

export const UPLOAD_AUTH_CANCELLED_MESSAGE =
  'Upload authorization cancelled.';

export type PinataUploadAuth = {
  walletAddress: string;
  message: string;
  signature: string;
};

function encodeUploadAuthMessageForHeader(message: string): string {
  const bytes = new TextEncoder().encode(message);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function isUploadAuthRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  return (
    lower.includes('user rejected') ||
    lower.includes('user declined') ||
    lower.includes('rejected the request') ||
    lower.includes('request rejected') ||
    lower.includes('cancelled') ||
    lower.includes('canceled') ||
    lower.includes('4001')
  );
}

export async function requestPinataUploadAuthorization(
  walletProvider: SolanaWalletProvider,
  walletAddress: string,
  walletId?: string
): Promise<PinataUploadAuth> {
  const uploadProvider = walletId
    ? prepareProviderForUploadAuth(walletProvider, walletId)
    : walletProvider;

  if (walletId) {
    logUploadAuthorizationWalletDebug(walletId, uploadProvider);
  }

  if (typeof uploadProvider.signMessage !== 'function') {
    throw new Error(UPLOAD_AUTH_UNSUPPORTED_WALLET_MESSAGE);
  }

  const message = buildPinataUploadAuthMessage(walletAddress);
  const messageBytes = new TextEncoder().encode(message);

  try {
    const result = await uploadProvider.signMessage(messageBytes, 'utf8');

    if (!result?.signature) {
      throw new Error(UPLOAD_AUTH_UNSUPPORTED_WALLET_MESSAGE);
    }

    return {
      walletAddress,
      message,
      signature: bs58.encode(result.signature),
    };
  } catch (error) {
    if (isUploadAuthRejection(error)) {
      throw new Error(UPLOAD_AUTH_CANCELLED_MESSAGE);
    }

    throw error;
  }
}

async function uploadFormDataToPinata(
  formData: FormData,
  auth: PinataUploadAuth
): Promise<{ IpfsHash: string }> {
  const response = await fetch(PINATA_UPLOAD_API, {
    method: 'POST',
    headers: {
      'x-wallet-address': auth.walletAddress,
      'x-upload-message': encodeUploadAuthMessageForHeader(auth.message),
      'x-upload-signature': auth.signature,
    },
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Pinata upload failed.';

    try {
      const data = await response.json();

      if (typeof data?.error === 'string') {
        errorMessage = data.error;
      }
    } catch {
      // keep generic message
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (!data.IpfsHash) {
    throw new Error('Pinata upload failed.');
  }

  return data;
}

export async function uploadFileToPinata(file: File, auth: PinataUploadAuth) {
  const formData = new FormData();
  formData.append('file', file);
  const data = await uploadFormDataToPinata(formData, auth);
  const ipfsUri = toIpfsUri(data.IpfsHash);

  return {
    ipfsHash: data.IpfsHash,
    ipfsUri,
    gatewayUrl: toPinataGatewayUrl(data.IpfsHash),
  };
}

export async function uploadNftMetadataToPinata(
  metadata: NftJsonMetadata,
  auth: PinataUploadAuth
) {
  const metadataFile = new File(
    [JSON.stringify(metadata)],
    'metadata.json',
    { type: 'application/json' }
  );

  const formData = new FormData();
  formData.append('file', metadataFile);
  const data = await uploadFormDataToPinata(formData, auth);

  return {
    ipfsHash: data.IpfsHash,
    ipfsUri: toIpfsUri(data.IpfsHash),
    gatewayUrl: toPinataGatewayUrl(data.IpfsHash),
  };
}
