/**
 * Vercel serverless proxy for Solana mainnet JSON-RPC.
 * HELIUS_MAINNET_RPC must stay server-side (never VITE_*).
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function sanitizeProxyError(error) {
  const name = error?.name ? String(error.name) : 'Error';
  let message = error?.message ? String(error.message) : 'unknown';

  message = message.replace(/https?:\/\/[^\s]+/gi, '[redacted-url]');
  message = message.replace(/api-key=[^&\s]+/gi, 'api-key=[redacted]');

  if (/helius/i.test(message)) {
    message = '[redacted]';
  }

  return { name, message };
}

async function readRequestBody(req) {
  if (typeof req.body === 'string') {
    return req.body;
  }

  if (req.body !== undefined && req.body !== null) {
    return JSON.stringify(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const rpcUrl = process.env.HELIUS_MAINNET_RPC?.trim();

  if (!rpcUrl) {
    sendJson(res, 500, { error: 'Mainnet RPC is not configured.' });
    return;
  }

  let stage = 'read_body';

  try {
    const body = await readRequestBody(req);

    stage = 'upstream_fetch';
    const upstream = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    stage = 'upstream_read';
    const responseText = await upstream.text();

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(responseText);
  } catch (error) {
    const safe = sanitizeProxyError(error);
    console.error('[api/rpc]', stage, safe.name, safe.message);
    sendJson(res, 502, { error: 'RPC upstream unavailable' });
  }
}
