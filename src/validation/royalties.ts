export const MAX_ROYALTY_PERCENT = 100;
export const MIN_ROYALTY_PERCENT = 0;

export function royaltyPercentToBasisPoints(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new Error('Royalty must be a number.');
  }

  if (percent < MIN_ROYALTY_PERCENT || percent > MAX_ROYALTY_PERCENT) {
    throw new Error('Royalty must be between 0% and 100%.');
  }

  return Math.round(percent * 100);
}

export function parseRoyaltyPercent(
  raw: string
): { ok: true; percent: number; basisPoints: number } | { ok: false; error: string } {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: true, percent: 0, basisPoints: 0 };
  }

  const percent = Number(trimmed);

  if (!Number.isFinite(percent)) {
    return { ok: false, error: 'Royalty must be a number between 0 and 100.' };
  }

  if (percent < MIN_ROYALTY_PERCENT || percent > MAX_ROYALTY_PERCENT) {
    return { ok: false, error: 'Royalty must be between 0% and 100%.' };
  }

  const rounded = Math.round(percent * 100) / 100;

  return {
    ok: true,
    percent: rounded,
    basisPoints: royaltyPercentToBasisPoints(rounded),
  };
}
