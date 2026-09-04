/**
 * CBS Collection Cap v1 client constants.
 *
 * The on-chain program ID is TEST ONLY until an explicit cluster deploy.
 * Do not treat an undeployed ID as live CBS. Never bundle the program keypair.
 */

export const CBS_COLLECTION_CAP_PROGRAM_VERSION = 1 as const;

export const CBS_COLLECTION_CAP_PROGRAM_LABEL = 'CBS Collection Cap v1';

export type CollectionCapNetwork = 'devnet' | 'mainnet';

function readPublicProgramId(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  if (!value) {
    return null;
  }
  return value;
}

/**
 * Devnet/local program ID from env. Unset until the operator configures it
 * after (or for) an explicit Devnet deploy. Not a production CBS claim.
 */
export const CBS_COLLECTION_CAP_DEVNET_PROGRAM_ID: string | null = readPublicProgramId(
  import.meta.env.VITE_CBS_COLLECTION_CAP_PROGRAM_ID
);

/**
 * Approved Mainnet program ID. Unset until an explicit production review.
 * Env cannot enable Mainnet; this constant must stay null until then.
 */
export const CBS_COLLECTION_CAP_MAINNET_PROGRAM_ID: string | null = null;

/** False: ID is a real local keypair pubkey, not a made-up placeholder. */
export const CBS_COLLECTION_CAP_PROGRAM_ID_IS_PLACEHOLDER = false;

/** False until this ID is deployed to a public cluster. TEST ONLY until then. */
export const CBS_COLLECTION_CAP_CLUSTER_DEPLOYED = false;

/**
 * @deprecated Use `collectionCapProgramIdForNetwork`. Kept as the Devnet env
 * value (possibly null) so callers do not fall back to a hardcoded placeholder.
 */
export const CBS_COLLECTION_CAP_PROGRAM_ID = CBS_COLLECTION_CAP_DEVNET_PROGRAM_ID;

/**
 * Master integration switch. Must stay false until a cluster deployment is
 * locked, reviewed, and explicitly enabled. While false, NFT Builder must keep
 * showing planned-capacity copy — never "On-chain hard cap".
 */
export const CBS_COLLECTION_CAP_INTEGRATION_ENABLED = false;

export const CAP_PDA_SEED = 'collection_cap';
export const ITEM_PDA_SEED = 'collection_item';
export const CAP_VERSION_SEED = 'v1';

/** Matches on-chain `CollectionCap` discriminator. Not a live-program signal. */
export const CAP_ACCOUNT_DISCRIMINATOR = Uint8Array.from([
  0xcb, 0x5c, 0xa0, 0x01, 0xca, 0x00, 0x00, 0x01,
]);

export const TECHNICAL_MAX_CAPACITY = 10_000;
export const TECHNICAL_MIN_CAPACITY = 1;

export function collectionCapProgramIdForNetwork(
  network: CollectionCapNetwork
): string | null {
  if (network === 'mainnet') {
    return CBS_COLLECTION_CAP_MAINNET_PROGRAM_ID;
  }
  return CBS_COLLECTION_CAP_DEVNET_PROGRAM_ID;
}

/**
 * Integration is off unless the master flag is on AND the network has an
 * approved program ID. Mainnet cannot be enabled while the approved Mainnet
 * ID is null, even if someone flips the master flag or sets a Devnet env var.
 */
export function collectionCapIntegrationEnabledForNetwork(
  network: CollectionCapNetwork
): boolean {
  if (!CBS_COLLECTION_CAP_INTEGRATION_ENABLED) {
    return false;
  }
  if (!CBS_COLLECTION_CAP_CLUSTER_DEPLOYED) {
    return false;
  }
  if (network === 'mainnet') {
    return CBS_COLLECTION_CAP_MAINNET_PROGRAM_ID !== null;
  }
  return CBS_COLLECTION_CAP_DEVNET_PROGRAM_ID !== null;
}
