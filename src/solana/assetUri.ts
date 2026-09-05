export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
] as const;

export type DasFileLike = {
  uri?: unknown;
  cdn_uri?: unknown;
  mime?: unknown;
  type?: unknown;
};

export type DasContentLike = {
  json_uri?: unknown;
  links?: { image?: unknown };
  files?: DasFileLike[];
};

const metadataImageCache = new Map<string, string | null>();
const metadataImageInflight = new Map<string, Promise<string | null>>();

export function resetMetadataImageCache(): void {
  metadataImageCache.clear();
  metadataImageInflight.clear();
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pathnameWithoutQuery(uri: string): string {
  const withoutHash = uri.split('#')[0] ?? uri;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  return withoutQuery.toLowerCase();
}

function looksLikeJsonUri(uri: string): boolean {
  return pathnameWithoutQuery(uri).endsWith('.json');
}

function mimeValue(file: DasFileLike): string {
  return stringOrEmpty(file.mime) || stringOrEmpty(file.type);
}

function isImageMime(mime: string): boolean {
  const normalized = mime.toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith('image/')) {
    return true;
  }

  return normalized === 'png'
    || normalized === 'jpeg'
    || normalized === 'jpg'
    || normalized === 'gif'
    || normalized === 'webp'
    || normalized === 'svg'
    || normalized === 'avif';
}

function isNonImageMime(mime: string): boolean {
  const normalized = mime.toLowerCase();
  if (!normalized || isImageMime(normalized)) {
    return false;
  }

  return normalized.includes('json')
    || normalized.startsWith('video/')
    || normalized.startsWith('audio/')
    || normalized.startsWith('text/')
    || normalized.startsWith('application/');
}

export function isLikelyImageUri(uri: string | null | undefined): boolean {
  const trimmed = stringOrEmpty(uri);
  if (!trimmed || looksLikeJsonUri(trimmed)) {
    return false;
  }

  if (trimmed.startsWith('ipfs://')) {
    return true;
  }

  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

export function extractIpfsPath(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) {
    return null;
  }

  const protocol = trimmed.match(/^ipfs:\/\/(.*)$/i);
  if (protocol?.[1]) {
    return protocol[1].replace(/^ipfs\//i, '').replace(/^\/+/, '');
  }

  const gateway = trimmed.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i);
  if (gateway?.[1]) {
    return gateway[1];
  }

  return null;
}

export function ipfsGatewayUrl(path: string, gatewayIndex = 0): string | null {
  const base = IPFS_GATEWAYS[gatewayIndex];
  if (!base) {
    return null;
  }

  const normalized = path.replace(/^\/+/, '');
  if (!normalized) {
    return null;
  }

  return `${base}${normalized}`;
}

export function fetchableUri(uri: string, gatewayIndex = 0): string | null {
  const trimmed = uri.trim();
  if (!trimmed) {
    return null;
  }

  const ipfsPath = extractIpfsPath(trimmed);
  if (ipfsPath) {
    return ipfsGatewayUrl(ipfsPath, gatewayIndex);
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  return null;
}

export function normalizeAssetUri(
  uri: string | null | undefined,
  gatewayIndex = 0
): string | null {
  const trimmed = stringOrEmpty(uri);
  if (!trimmed || !isLikelyImageUri(trimmed)) {
    return null;
  }

  return fetchableUri(trimmed, gatewayIndex);
}

export function nextIpfsGatewaySrc(currentSrc: string): string | null {
  const trimmed = currentSrc.trim();
  if (!trimmed) {
    return null;
  }

  const path = extractIpfsPath(trimmed);
  if (!path) {
    return null;
  }

  const currentIndex = IPFS_GATEWAYS.findIndex((gateway) => trimmed.startsWith(gateway));
  if (currentIndex < 0) {
    return null;
  }

  return ipfsGatewayUrl(path, currentIndex + 1);
}

function pickFileUri(file: DasFileLike): string | null {
  const mime = mimeValue(file);
  if (isNonImageMime(mime)) {
    return null;
  }

  const cdnUri = stringOrEmpty(file.cdn_uri);
  if (isLikelyImageUri(cdnUri)) {
    return cdnUri;
  }

  const uri = stringOrEmpty(file.uri);
  if (isLikelyImageUri(uri)) {
    return uri;
  }

  return null;
}

export function resolveDasImageUri(content: DasContentLike | null | undefined): string | null {
  if (!content) {
    return null;
  }

  const fromLinks = stringOrEmpty(content.links?.image);
  if (isLikelyImageUri(fromLinks)) {
    return fromLinks;
  }

  const files = Array.isArray(content.files) ? content.files : [];

  for (const file of files) {
    if (isImageMime(mimeValue(file))) {
      const picked = pickFileUri(file);
      if (picked) {
        return picked;
      }
    }
  }

  for (const file of files) {
    if (!mimeValue(file) || isImageMime(mimeValue(file))) {
      const picked = pickFileUri(file);
      if (picked) {
        return picked;
      }
    }
  }

  return null;
}

export function resolveImageFromMetadataJson(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const image = stringOrEmpty(record.image);
  if (isLikelyImageUri(image)) {
    return image;
  }

  const properties =
    record.properties && typeof record.properties === 'object'
      ? (record.properties as Record<string, unknown>)
      : null;
  const files = Array.isArray(properties?.files) ? properties.files : [];

  return resolveDasImageUri({
    files: files.filter((file): file is DasFileLike => Boolean(file) && typeof file === 'object'),
  });
}

async function fetchMetadataImage(metadataUri: string): Promise<string | null> {
  const fetchUrl = fetchableUri(metadataUri);
  if (!fetchUrl) {
    return null;
  }

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    return resolveImageFromMetadataJson(data);
  } catch {
    return null;
  }
}

export async function resolveMetadataImageUri(metadataUri: string): Promise<string | null> {
  const key = metadataUri.trim();
  if (!key) {
    return null;
  }

  if (metadataImageCache.has(key)) {
    return metadataImageCache.get(key) ?? null;
  }

  const inflight = metadataImageInflight.get(key);
  if (inflight) {
    return inflight;
  }

  const pending = fetchMetadataImage(key).then((resolved) => {
    metadataImageCache.set(key, resolved);
    return resolved;
  });

  metadataImageInflight.set(key, pending);
  try {
    return await pending;
  } finally {
    metadataImageInflight.delete(key);
  }
}

export async function fillMissingArtworkFromMetadata<
  T extends { imageUri: string | null; metadataUri?: string },
>(items: readonly T[]): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.imageUri) {
        return item;
      }

      const metadataUri = item.metadataUri?.trim();
      if (!metadataUri) {
        return item;
      }

      try {
        const imageUri = await resolveMetadataImageUri(metadataUri);
        return imageUri ? { ...item, imageUri } : item;
      } catch {
        return item;
      }
    })
  );
}
