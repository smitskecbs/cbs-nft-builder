/**
 * Vercel serverless proxy for Solana mainnet JSON-RPC.
 * HELIUS_MAINNET_RPC must stay server-side (never VITE_*).
 */

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
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

  try {
    const body = await readRequestBody(req);

    const upstream = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseText = await upstream.text();

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(responseText);
  } catch {
    sendJson(res, 502, { error: 'RPC upstream unavailable' });
  }
}
