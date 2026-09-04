import { describe, expect, it } from 'vitest';

import { evaluateLockPreflight } from './lockPreflight';

describe('lock preflight', () => {
  it('refuses lock when a known CAR account still has data', () => {
    const result = evaluateLockPreflight({
      wallet: 'Wallet111111111111111111111111111111111',
      currentUpdateAuthority: 'Wallet111111111111111111111111111111111',
      knownCarAccountData: [{ pda: 'Car111111111111111111111111111111111111', dataLength: 35 }],
    });
    expect(result.mayProceedToLock).toBe(false);
    expect(result.knownCarsStillOpen).toHaveLength(1);
    expect(result.warning).toContain('cannot be proven on-chain');
  });

  it('allows proceeding only when wallet is UA and known CARs are empty', () => {
    const result = evaluateLockPreflight({
      wallet: 'Wallet111111111111111111111111111111111',
      currentUpdateAuthority: 'Wallet111111111111111111111111111111111',
      knownCarAccountData: [{ pda: 'Car111111111111111111111111111111111111', dataLength: 0 }],
    });
    expect(result.mayProceedToLock).toBe(true);
    expect(result.knownCarsStillOpen).toEqual([]);
  });
});
