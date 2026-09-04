import { SIZE_CAP_IS_ON_CHAIN } from '../collection/constants';
import { remainingPlannedSlots } from './numbering';
import { isPreparedDraft, type StudioDraft } from './types';

export type StudioCapacityView = {
  plannedCapacity: number;
  mintedCount: number;
  verifiedCount: number;
  preparedCount: number;
  remainingPlanned: number;
  sizeCapIsOnChain: false;
  capacityLabel: string;
  remainingLabel: string;
};

export function studioCapacityView(params: {
  plannedCapacity: number;
  mintedCount: number;
  verifiedCount: number;
  drafts: readonly StudioDraft[];
}): StudioCapacityView {
  const remainingPlanned = remainingPlannedSlots(
    params.mintedCount,
    params.plannedCapacity
  );
  const preparedCount = params.drafts.filter((draft) => isPreparedDraft(draft.status)).length;

  return {
    plannedCapacity: params.plannedCapacity,
    mintedCount: params.mintedCount,
    verifiedCount: params.verifiedCount,
    preparedCount,
    remainingPlanned,
    sizeCapIsOnChain: SIZE_CAP_IS_ON_CHAIN,
    capacityLabel: `${params.mintedCount} / ${params.plannedCapacity}`,
    remainingLabel: `${remainingPlanned} planned slot${remainingPlanned === 1 ? '' : 's'} remaining`,
  };
}
