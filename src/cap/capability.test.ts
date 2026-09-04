import { describe, expect, it } from 'vitest';

import { ON_CHAIN_HARD_CAP_IMPLEMENTED, SIZE_CAP_IS_ON_CHAIN } from '../collection/constants';

import {
  builderMustUsePlannedCapacityCopy,
  deriveCollectionCapView,
  futureOnChainCapCopy,
  mapCapSnapshotToView,
  type CollectionCapSnapshot,
} from './capability';
import {
  CBS_COLLECTION_CAP_CLUSTER_DEPLOYED,
  CBS_COLLECTION_CAP_DEVNET_PROGRAM_ID,
  CBS_COLLECTION_CAP_INTEGRATION_ENABLED,
  CBS_COLLECTION_CAP_MAINNET_PROGRAM_ID,
  CBS_COLLECTION_CAP_PROGRAM_ID_IS_PLACEHOLDER,
  CBS_COLLECTION_CAP_PROGRAM_LABEL,
  collectionCapIntegrationEnabledForNetwork,
  TECHNICAL_MAX_CAPACITY,
} from './program';

const lockedSnapshot: CollectionCapSnapshot = {
  capAccountExists: true,
  locked: true,
  collectionUpdateAuthorityIsCapPda: true,
  verifiedCount: 7,
  maxCapacity: 100,
  programUpgradeable: true,
};

describe('collection cap capability detection', () => {
  it('keeps integration disabled and planned-capacity flags false', () => {
    expect(CBS_COLLECTION_CAP_INTEGRATION_ENABLED).toBe(false);
    expect(SIZE_CAP_IS_ON_CHAIN).toBe(false);
    expect(ON_CHAIN_HARD_CAP_IMPLEMENTED).toBe(false);
    expect(builderMustUsePlannedCapacityCopy()).toBe(true);
    expect(CBS_COLLECTION_CAP_PROGRAM_ID_IS_PLACEHOLDER).toBe(false);
    expect(CBS_COLLECTION_CAP_CLUSTER_DEPLOYED).toBe(false);
    expect(CBS_COLLECTION_CAP_MAINNET_PROGRAM_ID).toBeNull();
    expect(collectionCapIntegrationEnabledForNetwork('devnet')).toBe(false);
    expect(collectionCapIntegrationEnabledForNetwork('mainnet')).toBe(false);
    expect(CBS_COLLECTION_CAP_DEVNET_PROGRAM_ID === null || CBS_COLLECTION_CAP_DEVNET_PROGRAM_ID.length > 0).toBe(
      true
    );
    expect(TECHNICAL_MAX_CAPACITY).toBe(10_000);
  });

  it('does not claim an on-chain hard cap while integration is disabled', () => {
    const view = deriveCollectionCapView(lockedSnapshot);
    expect(view.status).toBe('planned');
    expect(view.statusLabel).toBe('Planned');
    expect(view.capDisplay).toBe('CBS planned capacity');
    expect(view.mayClaimOnChainHardCap).toBe(false);
    expect(view.mayClaimImmutableHardCap).toBe(false);
    expect(view.onChainCapacityLabel).toBeNull();
    expect(futureOnChainCapCopy(view)).toBeNull();
    expect(JSON.stringify(view).toLowerCase()).not.toContain('on-chain hard cap');
    expect(JSON.stringify(view).toLowerCase()).not.toContain('mathematically permanent');
    expect(JSON.stringify(view).toLowerCase()).not.toContain('cannot ever be changed');
  });

  it('maps locked + upgradeable state to honest copy when hypothetically enabled', () => {
    const view = mapCapSnapshotToView(lockedSnapshot);
    expect(view.status).toBe('hard_cap_locked');
    expect(view.statusLabel).toBe('Hard cap locked');
    expect(view.capDisplay).toBe('Hard cap enforced');
    expect(view.authorityLabel).toBe('Program controlled');
    expect(view.programLabel).toBe(CBS_COLLECTION_CAP_PROGRAM_LABEL);
    expect(view.mayClaimOnChainHardCap).toBe(true);
    expect(view.mayClaimImmutableHardCap).toBe(false);
    expect(view.guarantee).toBe('hard_cap_enforced');
    expect(view.permanenceLabel).toBe('Program upgradeable');
    expect(futureOnChainCapCopy(view)).toEqual({
      onChainCapacity: '7 / 100',
      remaining: '93',
      cap: 'Hard cap enforced',
      program: 'CBS Collection Cap v1',
      authority: 'Program controlled',
      permanence: 'Program upgradeable',
    });
    expect(view.permanenceLabel).not.toBe('Immutable');
  });

  it('never claims an immutable hard cap, even if program bytecode has no upgrade authority', () => {
    const view = mapCapSnapshotToView({
      ...lockedSnapshot,
      programUpgradeable: false,
    });
    expect(view.mayClaimOnChainHardCap).toBe(true);
    expect(view.mayClaimImmutableHardCap).toBe(false);
    expect(view.guarantee).toBe('hard_cap_enforced_program_immutable');
    expect(view.permanenceLabel).toBe('Program bytecode immutable');
    expect(futureOnChainCapCopy(view)?.permanence).toBe('Program bytecode immutable');
    expect(JSON.stringify(view).toLowerCase()).not.toContain('immutable hard cap');
  });

  it('does not claim a hard cap before lock or before PDA exclusive authority', () => {
    expect(mapCapSnapshotToView({
      ...lockedSnapshot,
      capAccountExists: false,
    }).status).toBe('planned');
    expect(mapCapSnapshotToView({
      ...lockedSnapshot,
      locked: false,
      collectionUpdateAuthorityIsCapPda: false,
    })).toMatchObject({
      status: 'cap_initialized',
      statusLabel: 'Cap initialized',
      mayClaimOnChainHardCap: false,
      capDisplay: 'CBS planned capacity',
    });
    expect(mapCapSnapshotToView({
      ...lockedSnapshot,
      collectionUpdateAuthorityIsCapPda: false,
    })).toMatchObject({
      status: 'authority_pending',
      statusLabel: 'Authority pending',
      mayClaimOnChainHardCap: false,
    });
  });
});
