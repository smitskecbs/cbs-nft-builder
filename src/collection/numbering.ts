import {
  DEFAULT_DIGIT_COUNT,
  DEFAULT_PLANNED_CAPACITY,
  DEFAULT_START_NUMBER,
} from './constants';
import {
  buildStudioItemName,
  canAddPlannedItem,
  canAllocateStudioNumber,
  defaultStudioNumbering,
  extractStudioItemNumberFromName,
  formatStudioItemNumber,
  nextStudioItemNumber,
  parseStudioItemNumber,
  usedStudioNumbers,
} from '../studio/numbering';

export function formatCollectionItemNumber(
  n: number,
  digitCount = DEFAULT_DIGIT_COUNT
): string {
  return formatStudioItemNumber(n, digitCount);
}

export function extractItemNumberFromName(name: string): number | null {
  return extractStudioItemNumberFromName(name);
}

export function parseCollectionItemNumber(value: string): number | null {
  const n = parseStudioItemNumber(value);

  if (n === null || n < 1 || n > DEFAULT_PLANNED_CAPACITY) {
    return null;
  }

  return n;
}

export function buildCollectionItemName(
  prefix: string,
  n: number,
  digitCount = DEFAULT_DIGIT_COUNT
): string {
  return buildStudioItemName(
    defaultStudioNumbering({ baseName: prefix, digitCount }),
    n
  );
}

const DEFAULT_FALLBACK_PREFIX = 'Item';

export function itemPrefixFromCollectionName(collectionName: string): string {
  return collectionName.replace(/\s*collection\s*$/i, '').trim() || collectionName.trim() || DEFAULT_FALLBACK_PREFIX;
}

export function usedItemNumbers(
  existing: readonly number[],
  plannedCapacity = DEFAULT_PLANNED_CAPACITY,
  start = DEFAULT_START_NUMBER
): number[] {
  return usedStudioNumbers(
    existing,
    defaultStudioNumbering({ plannedCapacity, start })
  );
}

export function nextAvailableItemNumber(
  existing: readonly number[],
  plannedCapacity = DEFAULT_PLANNED_CAPACITY,
  start = DEFAULT_START_NUMBER
): number | null {
  return nextStudioItemNumber(
    existing,
    defaultStudioNumbering({ plannedCapacity, start })
  );
}

export function canAllocateItemNumber(
  existing: readonly number[],
  requested: number,
  plannedCapacity = DEFAULT_PLANNED_CAPACITY,
  start = DEFAULT_START_NUMBER
): { ok: true } | { ok: false; error: string } {
  return canAllocateStudioNumber(
    existing,
    requested,
    defaultStudioNumbering({ plannedCapacity, start })
  );
}

export function canAddCollectionItem(
  currentCount: number,
  plannedCapacity = DEFAULT_PLANNED_CAPACITY
): { ok: true } | { ok: false; error: string } {
  return canAddPlannedItem(currentCount, plannedCapacity);
}
