import bs58 from 'bs58';

function bytesFromUnknown(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return Uint8Array.from(value);
  }

  return null;
}

/**
 * Accepts Umi Uint8Array signatures and wallet adapter shapes such as
 * `{ signature: Uint8Array | string }` without logging the value.
 */
export function tryFormatUmiTransactionSignature(
  signature: unknown
): string | null {
  if (typeof signature === 'string') {
    const trimmed = signature.trim();
    return trimmed || null;
  }

  const directBytes = bytesFromUnknown(signature);

  if (directBytes && directBytes.length > 0) {
    return bs58.encode(directBytes);
  }

  if (signature && typeof signature === 'object') {
    const nested = signature as { signature?: unknown };
    if ('signature' in nested && nested.signature !== signature) {
      return tryFormatUmiTransactionSignature(nested.signature);
    }
  }

  return null;
}

export function formatUmiTransactionSignature(signature: unknown): string {
  const formatted = tryFormatUmiTransactionSignature(signature);

  if (!formatted) {
    throw new Error('Unable to format transaction signature.');
  }

  return formatted;
}
