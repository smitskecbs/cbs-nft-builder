import type { NftAttribute } from '../validation/attributes';

export type NftJsonMetadataInput = {
  name: string;
  symbol: string;
  description: string;
  imageIpfsUri: string;
  imageMimeType: string;
  externalUrl?: string;
  attributes: NftAttribute[];
  creatorAddress: string;
};

export type NftJsonMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: NftAttribute[];
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: 'image';
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
  external_url?: string;
};

export function toIpfsUri(cid: string): string {
  const trimmed = cid.trim();

  if (!trimmed) {
    throw new Error('Missing IPFS CID.');
  }

  if (trimmed.startsWith('ipfs://')) {
    return trimmed;
  }

  return `ipfs://${trimmed}`;
}

export function toPinataGatewayUrl(cid: string): string {
  const hash = cid.replace(/^ipfs:\/\//, '').trim();
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

export function buildNftMetadata(input: NftJsonMetadataInput): NftJsonMetadata {
  const image = toIpfsUri(input.imageIpfsUri);

  const metadata: NftJsonMetadata = {
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image,
    attributes: input.attributes,
    properties: {
      files: [
        {
          uri: image,
          type: input.imageMimeType,
        },
      ],
      category: 'image',
      creators: [
        {
          address: input.creatorAddress,
          share: 100,
        },
      ],
    },
  };

  if (input.externalUrl) {
    metadata.external_url = input.externalUrl;
  }

  return metadata;
}
