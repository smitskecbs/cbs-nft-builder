/**
 * Read-only parser for BPF Loader Upgradeable ProgramData accounts.
 * Never sends SetAuthority.
 *
 * Layout is Solana bincode `UpgradeableLoaderState`:
 * variant u32 LE (ProgramData = 3), slot u64 LE, then Option<Pubkey>
 * as u8 tag (0 = None, 1 = Some) + 32 bytes.
 */

import bs58 from 'bs58';

export const BPF_LOADER_UPGRADEABLE_ID =
  'BPFLoaderUpgradeab1e11111111111111111111111';

export type ProgramDataAuthorityParse =
  | { kind: 'upgradeable'; upgradeAuthority: string }
  | { kind: 'immutable' }
  | { kind: 'unrecognized' };

const PROGRAMDATA_VARIANT = 3;

function readU32Le(data: Uint8Array, offset: number): number {
  return (
    (data[offset]! |
      (data[offset + 1]! << 8) |
      (data[offset + 2]! << 16) |
      (data[offset + 3]! << 24)) >>>
    0
  );
}

export function parseProgramDataUpgradeAuthority(data: Uint8Array): ProgramDataAuthorityParse {
  if (data.length < 13) {
    return { kind: 'unrecognized' };
  }
  const variant = readU32Le(data, 0);
  if (variant !== PROGRAMDATA_VARIANT) {
    return { kind: 'unrecognized' };
  }
  const optionTag = data[12];
  if (optionTag === 0) {
    return { kind: 'immutable' };
  }
  if (optionTag === 1 && data.length >= 45) {
    return {
      kind: 'upgradeable',
      upgradeAuthority: bs58.encode(data.subarray(13, 45)),
    };
  }
  return { kind: 'unrecognized' };
}
