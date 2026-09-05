import { describe, expect, it, vi } from 'vitest';

import { sendMintBuilder } from './sendMintBuilder';

const MINT = 'Mint111Mint111Mint111Mint111111111111111111';

describe('sendMintBuilder progress hooks', () => {
  it('reports awaiting wallet before send and confirming after send succeeds', async () => {
    const stages: string[] = [];
    const send = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));
    const confirm = vi.fn(async () => undefined);

    const result = await sendMintBuilder({
      umi: {} as never,
      builder: { send, confirm } as never,
      mintAddress: MINT,
      onSendProgress: (stage) => stages.push(stage),
    });

    expect(stages).toEqual(['awaiting_wallet', 'confirming']);
    expect(send).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.mintAddress).toBe(MINT);
    expect(result.confirmSucceeded).toBe(true);
  });

  it('does not report confirming when the wallet rejects send', async () => {
    const stages: string[] = [];
    const send = vi.fn(async () => {
      throw new Error('User rejected the request');
    });
    const confirm = vi.fn(async () => undefined);

    await expect(
      sendMintBuilder({
        umi: {} as never,
        builder: { send, confirm } as never,
        mintAddress: MINT,
        onSendProgress: (stage) => stages.push(stage),
      })
    ).rejects.toThrow('User rejected the request');

    expect(stages).toEqual(['awaiting_wallet']);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('still succeeds when confirm fails after send', async () => {
    const stages: string[] = [];

    const result = await sendMintBuilder({
      umi: {} as never,
      builder: {
        send: async () => new Uint8Array([1, 2, 3, 4]),
        confirm: async () => {
          throw new Error('not confirmed');
        },
      } as never,
      mintAddress: MINT,
      onSendProgress: (stage) => stages.push(stage),
    });

    expect(stages).toEqual(['awaiting_wallet', 'confirming']);
    expect(result.confirmSucceeded).toBe(false);
    expect(result.showIndexingNotice).toBe(true);
  });
});
