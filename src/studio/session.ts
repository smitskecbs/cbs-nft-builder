import type { CachedCollection } from '../collection/persistence';
import { defaultStudioDefaults } from './defaults';
import { defaultStudioNumbering, type StudioNumbering } from './numbering';
import type { StudioDefaults } from './types';

export function numberingFromCollection(collection: CachedCollection): StudioNumbering {
  return defaultStudioNumbering({
    baseName: collection.itemNamePrefix,
    digitCount: collection.digitCount,
    start: collection.startNumber,
    plannedCapacity: collection.plannedMaxItems,
  });
}

export function defaultsFromCollection(collection: CachedCollection): StudioDefaults {
  return defaultStudioDefaults({
    symbol: collection.symbol,
    description: collection.commonDescription,
    externalUrl: collection.commonExternalUrl,
    royaltyPercent: collection.commonRoyaltyPercent,
    isMutable: collection.isMutableDefault,
    attributes: collection.commonAttributes,
  });
}
