import { MAX_NFT_NAME_LENGTH } from '../metadata/nftLimits';
import {
  DEFAULT_DIGIT_COUNT,
  DEFAULT_PLANNED_CAPACITY,
  DEFAULT_START_NUMBER,
  MAX_DIGIT_COUNT,
  MAX_PLANNED_CAPACITY,
  MIN_DIGIT_COUNT,
  MIN_PLANNED_CAPACITY,
} from '../collection/constants';

export type StudioNumbering = {
  baseName: string;
  digitCount: number;
  start: number;
  plannedCapacity: number;
};

export type NumberingRange = {
  first: number;
  last: number;
};

export function defaultStudioNumbering(
  overrides: Partial<StudioNumbering> = {}
): StudioNumbering {
  return {
    baseName: 'ManGo Pixel',
    digitCount: DEFAULT_DIGIT_COUNT,
    start: DEFAULT_START_NUMBER,
    plannedCapacity: DEFAULT_PLANNED_CAPACITY,
    ...overrides,
  };
}

export function numberingRange(config: StudioNumbering): NumberingRange {
  return {
    first: config.start,
    last: config.start + config.plannedCapacity - 1,
  };
}

export function formatStudioItemNumber(n: number, digitCount: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('Item number must be a non-negative integer.');
  }

  if (!Number.isInteger(digitCount) || digitCount < MIN_DIGIT_COUNT) {
    throw new Error('Digit count is invalid.');
  }

  return `#${String(n).padStart(digitCount, '0')}`;
}

export function buildStudioItemName(config: StudioNumbering, n: number): string {
  const base = config.baseName.trim() || 'Item';
  return `${base} ${formatStudioItemNumber(n, config.digitCount)}`;
}

export function parseStudioItemNumber(value: string): number | null {
  const match = value.trim().match(/^#?0*(\d+)$/);

  if (!match) {
    return null;
  }

  const n = Number(match[1]);
  return Number.isInteger(n) ? n : null;
}

export function extractStudioItemNumberFromName(name: string): number | null {
  const match = name.trim().match(/#0*(\d+)\s*$/);

  if (!match) {
    return parseStudioItemNumber(name);
  }

  return parseStudioItemNumber(`#${match[1]}`);
}

export function usedStudioNumbers(existing: readonly number[], config: StudioNumbering): number[] {
  const { first, last } = numberingRange(config);
  return [
    ...new Set(
      existing.filter((n) => Number.isInteger(n) && n >= first && n <= last)
    ),
  ].sort((a, b) => a - b);
}

export function nextStudioItemNumber(
  existing: readonly number[],
  config: StudioNumbering
): number | null {
  const used = new Set(usedStudioNumbers(existing, config));
  const { first, last } = numberingRange(config);

  for (let n = first; n <= last; n += 1) {
    if (!used.has(n)) {
      return n;
    }
  }

  return null;
}

export function canAllocateStudioNumber(
  existing: readonly number[],
  requested: number,
  config: StudioNumbering
): { ok: true } | { ok: false; error: string } {
  const { first, last } = numberingRange(config);

  if (!Number.isInteger(requested) || requested < first || requested > last) {
    return {
      ok: false,
      error: `Item number must be between ${formatStudioItemNumber(first, config.digitCount)} and ${formatStudioItemNumber(last, config.digitCount)}.`,
    };
  }

  if (usedStudioNumbers(existing, config).includes(requested)) {
    return {
      ok: false,
      error: `Item ${formatStudioItemNumber(requested, config.digitCount)} is already used in this collection.`,
    };
  }

  return { ok: true };
}

export function remainingPlannedSlots(
  mintedCount: number,
  plannedCapacity: number
): number {
  return Math.max(0, plannedCapacity - mintedCount);
}

export function canAddPlannedItem(
  currentMintedCount: number,
  plannedCapacity: number
): { ok: true } | { ok: false; error: string } {
  if (currentMintedCount >= plannedCapacity) {
    return {
      ok: false,
      error: `CBS planned capacity of ${plannedCapacity} items has been reached. This is not an on-chain maximum.`,
    };
  }

  return { ok: true };
}

export function previewStudioNames(config: StudioNumbering, sampleCount = 3): string[] {
  const { first, last } = numberingRange(config);
  const names: string[] = [];
  const head = Math.min(sampleCount, config.plannedCapacity);

  for (let i = 0; i < head; i += 1) {
    names.push(buildStudioItemName(config, first + i));
  }

  if (config.plannedCapacity > sampleCount) {
    names.push(buildStudioItemName(config, last));
  }

  return names;
}

export function validateStudioNumbering(
  config: StudioNumbering
): { ok: true; value: StudioNumbering } | { ok: false; error: string } {
  const baseName = config.baseName.trim();

  if (!baseName) {
    return { ok: false, error: 'Item base name is required.' };
  }

  if (!Number.isInteger(config.digitCount) || config.digitCount < MIN_DIGIT_COUNT || config.digitCount > MAX_DIGIT_COUNT) {
    return {
      ok: false,
      error: `Number format must be ${MIN_DIGIT_COUNT} to ${MAX_DIGIT_COUNT} digits.`,
    };
  }

  if (!Number.isInteger(config.start) || config.start < 1) {
    return { ok: false, error: 'Start number must be an integer of 1 or higher.' };
  }

  if (
    !Number.isInteger(config.plannedCapacity) ||
    config.plannedCapacity < MIN_PLANNED_CAPACITY ||
    config.plannedCapacity > MAX_PLANNED_CAPACITY
  ) {
    return {
      ok: false,
      error: `Planned capacity must be an integer from ${MIN_PLANNED_CAPACITY} to ${MAX_PLANNED_CAPACITY}.`,
    };
  }

  const sample = buildStudioItemName({ ...config, baseName }, config.start);

  if (sample.length > MAX_NFT_NAME_LENGTH) {
    return {
      ok: false,
      error: `Generated names such as "${sample}" exceed the ${MAX_NFT_NAME_LENGTH}-character Metaplex name limit.`,
    };
  }

  const lastName = buildStudioItemName(
    { ...config, baseName },
    numberingRange(config).last
  );

  if (lastName.length > MAX_NFT_NAME_LENGTH) {
    return {
      ok: false,
      error: `Generated names such as "${lastName}" exceed the ${MAX_NFT_NAME_LENGTH}-character Metaplex name limit.`,
    };
  }

  return {
    ok: true,
    value: {
      baseName,
      digitCount: config.digitCount,
      start: config.start,
      plannedCapacity: config.plannedCapacity,
    },
  };
}
