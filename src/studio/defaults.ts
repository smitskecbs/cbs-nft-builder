import type { StudioDefaults } from './types';
import type { NftAttribute } from '../validation/attributes';

export function defaultStudioDefaults(
  overrides: Partial<StudioDefaults> = {}
): StudioDefaults {
  return {
    symbol: '',
    description: '',
    externalUrl: '',
    royaltyPercent: 0,
    isMutable: true,
    attributes: [],
    ...overrides,
  };
}

export function inheritItemFields(
  defaults: StudioDefaults,
  overrides: {
    descriptionOverride?: string;
    externalUrlOverride?: string;
    attributes?: NftAttribute[] | null;
    attributesOverride?: NftAttribute[] | null;
    symbol?: string;
  } = {}
): {
  symbol: string;
  description: string;
  externalUrl: string;
  royaltyPercent: number;
  isMutable: boolean;
  attributes: NftAttribute[];
} {
  const hasDescription =
    typeof overrides.descriptionOverride === 'string' &&
    Object.prototype.hasOwnProperty.call(overrides, 'descriptionOverride');
  const hasExternalUrl =
    typeof overrides.externalUrlOverride === 'string' &&
    Object.prototype.hasOwnProperty.call(overrides, 'externalUrlOverride');
  const attributeSource = Object.prototype.hasOwnProperty.call(overrides, 'attributesOverride')
    ? overrides.attributesOverride
    : Object.prototype.hasOwnProperty.call(overrides, 'attributes')
      ? overrides.attributes
      : undefined;

  return {
    symbol: overrides.symbol?.trim() || defaults.symbol,
    description: hasDescription ? overrides.descriptionOverride ?? '' : defaults.description,
    externalUrl: hasExternalUrl ? overrides.externalUrlOverride ?? '' : defaults.externalUrl,
    royaltyPercent: defaults.royaltyPercent,
    isMutable: defaults.isMutable,
    attributes: attributeSource === undefined || attributeSource === null
      ? [...defaults.attributes]
      : [...attributeSource],
  };
}
