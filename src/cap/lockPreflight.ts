/**
 * Off-chain lock preflight. Cannot prove that no unknown legacy CAR exists.
 * Known delegate pubkeys can be checked by deriving the CAR PDA.
 */

export type LockPreflight = {
  currentUpdateAuthority: string;
  knownCarPdas: string[];
  knownCarsStillOpen: string[];
  mayProceedToLock: boolean;
  warning: string;
};

export function evaluateLockPreflight(input: {
  wallet: string;
  currentUpdateAuthority: string;
  knownCarAccountData: { pda: string; dataLength: number }[];
}): LockPreflight {
  const knownCarPdas = input.knownCarAccountData.map((row) => row.pda);
  const knownCarsStillOpen = input.knownCarAccountData
    .filter((row) => row.dataLength > 0)
    .map((row) => row.pda);
  const authorityMatches = input.currentUpdateAuthority === input.wallet;
  return {
    currentUpdateAuthority: input.currentUpdateAuthority,
    knownCarPdas,
    knownCarsStillOpen,
    mayProceedToLock: authorityMatches && knownCarsStillOpen.length === 0,
    warning:
      'Absence of unknown legacy Collection Authority Records cannot be proven on-chain. Current Token Metadata source rejects CARs whose stored update authority is not the current collection update authority.',
  };
}
