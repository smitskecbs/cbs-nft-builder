import { ON_CHAIN_HARD_CAP_IMPLEMENTED, SIZE_CAP_IS_ON_CHAIN } from '../collection/constants';

import {
  CBS_COLLECTION_CAP_INTEGRATION_ENABLED,
  CBS_COLLECTION_CAP_PROGRAM_LABEL,
} from './program';

/**
 * Lifecycle shown after a future integration. Until
 * `CBS_COLLECTION_CAP_INTEGRATION_ENABLED` is true, `deriveCollectionCapView`
 * always returns `planned` regardless of account data passed in.
 */
export type CapLifecycleStatus =
  | 'planned'
  | 'cap_initialized'
  | 'authority_pending'
  | 'hard_cap_locked';

export type CapPermanence = 'program_upgradeable' | 'program_bytecode_immutable';

export type HardCapGuarantee =
  | 'planned'
  | 'hard_cap_enforced'
  | 'hard_cap_enforced_program_immutable';

export type CollectionCapView = {
  status: CapLifecycleStatus;
  statusLabel: string;
  verifiedCount: number | null;
  maxCapacity: number | null;
  remaining: number | null;
  onChainCapacityLabel: string | null;
  remainingLabel: string | null;
  capLabel: 'planned' | 'hard_cap_enforced';
  capDisplay: string;
  programLabel: string;
  authorityLabel: string;
  permanence: CapPermanence | null;
  permanenceLabel: string | null;
  guarantee: HardCapGuarantee;
  mayClaimOnChainHardCap: boolean;
  /**
   * Always false. Legacy Collection Authority Records cannot be proven absent
   * on-chain, so CBS never claims an "immutable hard cap".
   */
  mayClaimImmutableHardCap: false;
};

export type CollectionCapSnapshot = {
  capAccountExists: boolean;
  locked: boolean;
  collectionUpdateAuthorityIsCapPda: boolean;
  verifiedCount: number;
  maxCapacity: number;
  /**
   * True when loader-v3 ProgramData `upgrade_authority_address` is Some.
   * False only when that field is None (immutable deployment). Never assume
   * immutable during development.
   */
  programUpgradeable: boolean;
};

const PLANNED_STATUS_LABEL = 'Planned';
const CAP_INITIALIZED_LABEL = 'Cap initialized';
const AUTHORITY_PENDING_LABEL = 'Authority pending';
const HARD_CAP_LOCKED_LABEL = 'Hard cap locked';

const PLANNED_CAP_DISPLAY = 'CBS planned capacity';
const HARD_CAP_ENFORCED_DISPLAY = 'Hard cap enforced';

const WALLET_AUTHORITY_LABEL = 'Wallet controlled';
const PROGRAM_AUTHORITY_LABEL = 'Program controlled';

const UPGRADEABLE_PERMANENCE_LABEL = 'Program upgradeable';
const BYTECODE_IMMUTABLE_LABEL = 'Program bytecode immutable';

export function builderMustUsePlannedCapacityCopy(): boolean {
  return (
    !CBS_COLLECTION_CAP_INTEGRATION_ENABLED ||
    !ON_CHAIN_HARD_CAP_IMPLEMENTED ||
    !SIZE_CAP_IS_ON_CHAIN
  );
}

function plannedView(): CollectionCapView {
  return {
    status: 'planned',
    statusLabel: PLANNED_STATUS_LABEL,
    verifiedCount: null,
    maxCapacity: null,
    remaining: null,
    onChainCapacityLabel: null,
    remainingLabel: null,
    capLabel: 'planned',
    capDisplay: PLANNED_CAP_DISPLAY,
    programLabel: CBS_COLLECTION_CAP_PROGRAM_LABEL,
    authorityLabel: WALLET_AUTHORITY_LABEL,
    permanence: null,
    permanenceLabel: null,
    guarantee: 'planned',
    mayClaimOnChainHardCap: false,
    mayClaimImmutableHardCap: false,
  };
}

export function deriveCollectionCapView(snapshot: CollectionCapSnapshot): CollectionCapView {
  if (builderMustUsePlannedCapacityCopy()) {
    return plannedView();
  }

  return mapCapSnapshotToView(snapshot);
}

/**
 * Maps on-chain cap state to UI. Not used by Collection Studio while
 * `builderMustUsePlannedCapacityCopy()` is true.
 */
export function mapCapSnapshotToView(snapshot: CollectionCapSnapshot): CollectionCapView {
  if (!snapshot.capAccountExists) {
    return plannedView();
  }

  if (!snapshot.locked) {
    return {
      ...plannedView(),
      status: 'cap_initialized',
      statusLabel: CAP_INITIALIZED_LABEL,
      verifiedCount: snapshot.verifiedCount,
      maxCapacity: snapshot.maxCapacity,
      remaining: snapshot.maxCapacity - snapshot.verifiedCount,
      capDisplay: PLANNED_CAP_DISPLAY,
      mayClaimOnChainHardCap: false,
      mayClaimImmutableHardCap: false,
    };
  }

  if (!snapshot.collectionUpdateAuthorityIsCapPda) {
    return {
      ...plannedView(),
      status: 'authority_pending',
      statusLabel: AUTHORITY_PENDING_LABEL,
      verifiedCount: snapshot.verifiedCount,
      maxCapacity: snapshot.maxCapacity,
      remaining: snapshot.maxCapacity - snapshot.verifiedCount,
      capDisplay: PLANNED_CAP_DISPLAY,
      mayClaimOnChainHardCap: false,
      mayClaimImmutableHardCap: false,
    };
  }

  const remaining = snapshot.maxCapacity - snapshot.verifiedCount;
  const programUpgradeable = snapshot.programUpgradeable;
  const permanence: CapPermanence = programUpgradeable
    ? 'program_upgradeable'
    : 'program_bytecode_immutable';

  return {
    status: 'hard_cap_locked',
    statusLabel: HARD_CAP_LOCKED_LABEL,
    verifiedCount: snapshot.verifiedCount,
    maxCapacity: snapshot.maxCapacity,
    remaining,
    onChainCapacityLabel: `${snapshot.verifiedCount} / ${snapshot.maxCapacity}`,
    remainingLabel: String(remaining),
    capLabel: 'hard_cap_enforced',
    capDisplay: HARD_CAP_ENFORCED_DISPLAY,
    programLabel: CBS_COLLECTION_CAP_PROGRAM_LABEL,
    authorityLabel: PROGRAM_AUTHORITY_LABEL,
    permanence,
    permanenceLabel: programUpgradeable
      ? UPGRADEABLE_PERMANENCE_LABEL
      : BYTECODE_IMMUTABLE_LABEL,
    guarantee: programUpgradeable
      ? 'hard_cap_enforced'
      : 'hard_cap_enforced_program_immutable',
    mayClaimOnChainHardCap: true,
    mayClaimImmutableHardCap: false,
  };
}

/** Future Collection Studio lines. Do not render while planned copy is required. */
export function futureOnChainCapCopy(view: CollectionCapView): {
  onChainCapacity: string;
  remaining: string;
  cap: string;
  program: string;
  authority: string;
  permanence: string | null;
} | null {
  if (!view.mayClaimOnChainHardCap || view.onChainCapacityLabel === null || view.remainingLabel === null) {
    return null;
  }

  return {
    onChainCapacity: view.onChainCapacityLabel,
    remaining: view.remainingLabel,
    cap: view.capDisplay,
    program: view.programLabel,
    authority: view.authorityLabel,
    permanence: view.permanenceLabel,
  };
}
