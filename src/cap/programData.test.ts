import { describe, expect, it } from 'vitest';
import bs58 from 'bs58';

import { parseProgramDataUpgradeAuthority } from './programData';

function programDataBytes(slot: bigint, authority: Uint8Array | null): Uint8Array {
  const out = new Uint8Array(authority ? 45 : 13);
  out[0] = 3;
  const slotView = new DataView(out.buffer);
  slotView.setBigUint64(4, slot, true);
  if (authority) {
    out[12] = 1;
    out.set(authority, 13);
  } else {
    out[12] = 0;
  }
  return out;
}

describe('ProgramData upgrade-authority parser', () => {
  it('parses Some(pubkey) as upgradeable', () => {
    const authority = new Uint8Array(32).fill(7);
    const parsed = parseProgramDataUpgradeAuthority(programDataBytes(42n, authority));
    expect(parsed.kind).toBe('upgradeable');
    if (parsed.kind === 'upgradeable') {
      expect(parsed.upgradeAuthority).toBe(bs58.encode(authority));
    }
  });

  it('parses None as bytecode-immutable', () => {
    expect(parseProgramDataUpgradeAuthority(programDataBytes(1n, null))).toEqual({
      kind: 'immutable',
    });
  });

  it('rejects garbage', () => {
    expect(parseProgramDataUpgradeAuthority(Uint8Array.from([0, 1, 2]))).toEqual({
      kind: 'unrecognized',
    });
  });
});
