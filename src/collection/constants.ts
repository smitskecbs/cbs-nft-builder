export const DEFAULT_PLANNED_CAPACITY = 100;

/** Planned CBS capacity default. Not an on-chain maximum. */
export const MAX_COLLECTION_ITEMS = DEFAULT_PLANNED_CAPACITY;

export const DEFAULT_DIGIT_COUNT = 3;
export const DEFAULT_START_NUMBER = 1;
export const MIN_DIGIT_COUNT = 1;
export const MAX_DIGIT_COUNT = 6;
export const MIN_PLANNED_CAPACITY = 1;
export const MAX_PLANNED_CAPACITY = 10_000;

export const COLLECTION_MODEL_LABEL = 'Metaplex Token Metadata';

export const COLLECTION_NFT_STANDARD = 'NonFungible' as const;

export const DEFAULT_COLLECTION_NAME = '';
export const DEFAULT_COLLECTION_SYMBOL = '';
export const DEFAULT_COLLECTION_DESCRIPTION = '';
export const DEFAULT_COLLECTION_EXTERNAL_URL = '';
export const DEFAULT_COLLECTION_ITEM_PREFIX = '';

/** Last-opened mint is a convenience pointer only. Never auto-open or prefill from it. */
export const AUTO_OPEN_LAST_COLLECTION = false;

export const RECENT_COLLECTIONS_STORAGE_PREFIX =
  'cbs-nft-builder.recent-collections.v1';

export const LAST_OPENED_COLLECTION_STORAGE_PREFIX =
  'cbs-nft-builder.last-opened-collection.v1';

export const STUDIO_DB_NAME = 'cbs-nft-builder.studio.v1';
export const STUDIO_DB_VERSION = 1;

/**
 * False until the Collection Cap program is deployed, locked, and verified.
 * Future on-chain copy lives in `src/cap/capability.ts` and must stay unused
 * while this flag is false. Studio keeps "CBS planned capacity".
 */
export const SIZE_CAP_IS_ON_CHAIN = false;
/** False until integration is explicitly enabled. Studio must keep planned copy. */
export const ON_CHAIN_HARD_CAP_IMPLEMENTED = false;

export const PLANNED_SIZE_LABEL = 'CBS planned capacity';
export const PLANNED_SIZE_NOT_ON_CHAIN_NOTE =
  'This is a CBS planned capacity, not an on-chain maximum. While the collection authority remains a wallet you control, items can still be verified outside CBS.';
