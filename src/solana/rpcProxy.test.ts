import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

type RpcHandler = (
  req: Readable & { method?: string; body?: unknown },
  res: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    setHeader(name: string, value: string): void;
    end(chunk?: string): void;
  }
) => Promise<void>;

const UPSTREAM_RPC = 'https://rpc.test.example/?api-key=test-upstream-secret';

async function loadHandler(): Promise<RpcHandler> {
  // @ts-expect-error Vercel handler is untyped JavaScript.
  const mod = (await import('../../api/rpc.js')) as { default: RpcHandler };
  return mod.default;
}

function createReq(method: string, body?: string) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body, 'utf8')]) as Readable & {
    method?: string;
    body?: unknown;
  };
  req.method = method;
  return req;
}

function createRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      this.body = chunk ?? '';
    },
  };
}

function withRpcEnv(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env.HELIUS_MAINNET_RPC;

  if (value === undefined) {
    delete process.env.HELIUS_MAINNET_RPC;
  } else {
    process.env.HELIUS_MAINNET_RPC = value;
  }

  return run().finally(() => {
    if (previous === undefined) {
      delete process.env.HELIUS_MAINNET_RPC;
    } else {
      process.env.HELIUS_MAINNET_RPC = previous;
    }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Mainnet RPC proxy', () => {
  it('rejects non-POST requests', async () => {
    const handler = await loadHandler();
    const res = createRes();

    await handler(createReq('GET'), res);

    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body)).toEqual({ error: 'Method not allowed' });
  });

  it('returns 500 JSON when HELIUS_MAINNET_RPC is missing', async () => {
    await withRpcEnv(undefined, async () => {
      const handler = await loadHandler();
      const res = createRes();

      await handler(createReq('POST', '{"jsonrpc":"2.0","id":1}'), res);

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body)).toEqual({
        error: 'Mainnet RPC is not configured.',
      });
    });
  });

  it('returns 502 JSON when the upstream fetch fails', async () => {
    await withRpcEnv(UPSTREAM_RPC, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down');
        })
      );

      const handler = await loadHandler();
      const res = createRes();

      await handler(createReq('POST', '{"jsonrpc":"2.0","id":1}'), res);

      expect(res.statusCode).toBe(502);
      expect(JSON.parse(res.body)).toEqual({
        error: 'RPC upstream unavailable',
      });
    });
  });

  it('forwards the POST body unchanged', async () => {
    const postedBody = '{"jsonrpc":"2.0","id":"cbs","method":"getHealth"}';

    await withRpcEnv(UPSTREAM_RPC, async () => {
      const fetchMock = vi.fn(
        async (_url: string, _init?: { method?: string; body?: string }) => ({
          status: 200,
          text: async () => '{"jsonrpc":"2.0","id":"cbs","result":"ok"}',
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const handler = await loadHandler();
      const res = createRes();

      await handler(createReq('POST', postedBody), res);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        method: 'POST',
        body: postedBody,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('{"jsonrpc":"2.0","id":"cbs","result":"ok"}');
    });
  });

  it('does not expose the upstream RPC URL in the response', async () => {
    await withRpcEnv(UPSTREAM_RPC, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          status: 200,
          text: async () => '{"jsonrpc":"2.0","id":1,"result":true}',
        }))
      );

      const handler = await loadHandler();
      const res = createRes();

      await handler(createReq('POST', '{"jsonrpc":"2.0","id":1}'), res);

      expect(res.body).not.toContain(UPSTREAM_RPC);
      expect(res.body.toLowerCase()).not.toContain('helius');
      expect(JSON.stringify(res.headers).toLowerCase()).not.toContain('helius');
    });
  });
});
