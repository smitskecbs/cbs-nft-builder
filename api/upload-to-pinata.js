/**
 * CBS NFT Builder Pinata upload API.
 * Future production origin is listed below. Add extra origins here if needed.
 */
const ALLOWED_ORIGINS = [
  "https://nft-builder.cbs-coin.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_AUTH_AGE_SECONDS = 300;
const MAX_FUTURE_SKEW_SECONDS = 60;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/json",
]);

const ALLOWED_REQUEST_HEADERS =
  "content-type, x-wallet-address, x-upload-message, x-upload-signature";

const LOG_PREFIX = "[upload-to-pinata]";

export const config = {
  api: {
    bodyParser: false,
  },
};

function logUploadDiag(phase, details = {}) {
  console.log(LOG_PREFIX, phase, details);
}

function logUploadWarn(phase, details = {}) {
  console.warn(LOG_PREFIX, phase, details);
}

function logUploadError(phase, details = {}) {
  console.error(LOG_PREFIX, phase, details);
}

function safeErrorDetails(error) {
  if (!error || typeof error !== "object") {
    return {
      errorName: "UnknownError",
      errorMessage: "Unknown error",
    };
  }

  return {
    errorName:
      typeof error.name === "string"
        ? error.name
        : "Error",
    errorMessage:
      typeof error.message === "string"
        ? error.message
        : "Unknown error",
    errorCode:
      typeof error.code === "string"
        ? error.code
        : undefined,
  };
}

function normalizeOrigin(origin) {
  if (typeof origin !== "string") {
    return null;
  }

  const trimmed = origin.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

function isAllowedOrigin(origin) {
  const normalized = normalizeOrigin(origin);

  if (!normalized) {
    return false;
  }

  return ALLOWED_ORIGINS.includes(normalized);
}

function getRequestOrigin(req) {
  const origin = req.headers?.origin;

  return normalizeOrigin(origin);
}

function getAuthHeaderPresence(req) {
  return {
    hasWalletAddressHeader: Boolean(req.headers["x-wallet-address"]),
    hasUploadMessageHeader: Boolean(req.headers["x-upload-message"]),
    hasUploadSignatureHeader: Boolean(req.headers["x-upload-signature"]),
  };
}

function getRequestDiagnostics(req) {
  const contentLength = req.headers["content-length"];

  return {
    method: req.method ?? "(unknown)",
    receivedOrigin: getRequestOrigin(req) ?? "(none)",
    pinataJwtExists: Boolean(process.env.PINATA_JWT),
    ...getAuthHeaderPresence(req),
    contentType: req.headers["content-type"] ?? "(none)",
    contentLength:
      typeof contentLength === "string"
        ? contentLength
        : "(none)",
  };
}

function setCorsHeaders(req, res) {
  const origin = getRequestOrigin(req);

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader(
    "Access-Control-Allow-Headers",
    ALLOWED_REQUEST_HEADERS
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function handleOptionsPreflight(req, res) {
  setCorsHeaders(req, res);
  res.statusCode = 204;
  res.end();
}

function handleCorsDebugGet(req, res) {
  setCorsHeaders(req, res);

  const origin = getRequestOrigin(req);

  sendJson(res, 200, {
    ok: true,
    envReady: Boolean(process.env.PINATA_JWT),
    allowedOrigins: ALLOWED_ORIGINS,
    receivedOrigin: origin ?? "(none)",
    originAllowed: origin ? isAllowedOrigin(origin) : false,
  });
}

function parseUploadAuthMessage(message) {
  if (typeof message !== "string" || !message.trim()) {
    return { ok: false, reasonCode: "missing_message" };
  }

  if (!message.includes("App: CBS NFT Builder")) {
    return { ok: false, reasonCode: "invalid_app_name" };
  }

  if (!message.includes("Purpose: Pinata upload")) {
    return { ok: false, reasonCode: "invalid_purpose" };
  }

  const walletMatch = message.match(/^Wallet:\s*(.+)$/m);
  const issuedMatch = message.match(/^Issued at \(unix\):\s*(\d+)$/m);
  const expiresMatch = message.match(/^Expires at \(unix\):\s*(\d+)$/m);

  if (!walletMatch || !issuedMatch || !expiresMatch) {
    return { ok: false, reasonCode: "invalid_message_format" };
  }

  const walletAddress = walletMatch[1].trim();
  const issuedAt = Number(issuedMatch[1]);
  const expiresAt = Number(expiresMatch[1]);

  if (!Number.isInteger(issuedAt) || !Number.isInteger(expiresAt)) {
    return { ok: false, reasonCode: "invalid_timestamp" };
  }

  if (expiresAt <= issuedAt) {
    return { ok: false, reasonCode: "invalid_expiry" };
  }

  if (expiresAt - issuedAt > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reasonCode: "expiry_window_too_long" };
  }

  const now = Math.floor(Date.now() / 1000);

  if (issuedAt > now + MAX_FUTURE_SKEW_SECONDS) {
    return { ok: false, reasonCode: "timestamp_too_far_in_future" };
  }

  if (now > expiresAt) {
    return { ok: false, reasonCode: "authorization_expired" };
  }

  if (now - issuedAt > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reasonCode: "authorization_too_old" };
  }

  return {
    ok: true,
    walletAddress,
    issuedAt,
    expiresAt,
  };
}

function decodeUploadAuthMessageHeader(encodedMessage) {
  if (typeof encodedMessage !== "string") {
    return null;
  }

  try {
    return Buffer.from(encodedMessage, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function decodeSolanaPublicKeyBytes(walletAddress, bs58) {
  if (typeof walletAddress !== "string" || !walletAddress.trim()) {
    return null;
  }

  try {
    const publicKeyBytes = bs58.decode(walletAddress.trim());

    if (publicKeyBytes.length !== 32) {
      return null;
    }

    return publicKeyBytes;
  } catch {
    return null;
  }
}

async function loadAuthCryptoModules() {
  const bs58Module = await import("bs58");
  const naclModule = await import("tweetnacl");

  return {
    bs58: bs58Module.default ?? bs58Module,
    nacl: naclModule.default ?? naclModule,
  };
}

async function verifyUploadAuthorization(req) {
  const walletAddress = req.headers["x-wallet-address"];
  const encodedMessage = req.headers["x-upload-message"];
  const signature = req.headers["x-upload-signature"];

  if (!walletAddress || !encodedMessage || !signature) {
    return {
      ok: false,
      status: 401,
      error: "Upload authorization required.",
      reasonCode: "missing_auth_headers",
      walletAddress:
        typeof walletAddress === "string"
          ? walletAddress
          : undefined,
    };
  }

  const message = decodeUploadAuthMessageHeader(encodedMessage);

  if (!message) {
    return {
      ok: false,
      status: 401,
      error: "Invalid upload authorization.",
      reasonCode: "invalid_message_encoding",
      walletAddress,
    };
  }

  let bs58;
  let nacl;

  try {
    ({ bs58, nacl } = await loadAuthCryptoModules());
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: "Pinata upload failed.",
      reasonCode: "auth_module_import_failed",
      walletAddress,
      ...safeErrorDetails(error),
    };
  }

  const publicKeyBytes = decodeSolanaPublicKeyBytes(
    walletAddress,
    bs58
  );

  if (!publicKeyBytes) {
    return {
      ok: false,
      status: 401,
      error: "Invalid wallet address.",
      reasonCode: "invalid_wallet_address",
      walletAddress,
    };
  }

  const parsedMessage = parseUploadAuthMessage(message);

  if (!parsedMessage.ok) {
    return {
      ok: false,
      status: 401,
      error: "Invalid upload authorization.",
      reasonCode: parsedMessage.reasonCode,
      walletAddress,
    };
  }

  if (parsedMessage.walletAddress !== walletAddress) {
    return {
      ok: false,
      status: 401,
      error: "Upload authorization wallet mismatch.",
      reasonCode: "wallet_mismatch",
      walletAddress,
    };
  }

  let signatureBytes;

  try {
    signatureBytes = bs58.decode(signature);
  } catch {
    return {
      ok: false,
      status: 401,
      error: "Invalid upload signature.",
      reasonCode: "signature_decode_failed",
      walletAddress,
    };
  }

  const messageBytes = new TextEncoder().encode(message);
  const valid = nacl.sign.detached.verify(
    messageBytes,
    signatureBytes,
    publicKeyBytes
  );

  if (!valid) {
    return {
      ok: false,
      status: 401,
      error: "Invalid upload signature.",
      reasonCode: "signature_invalid",
      walletAddress,
    };
  }

  return {
    ok: true,
    reasonCode: "auth_verified",
    walletAddress,
  };
}

async function readBodyWithLimit(req, maxBytes) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > maxBytes) {
      const error = new Error("BODY_TOO_LARGE");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }

    chunks.push(chunk);
  }

  return {
    bodyBuffer: Buffer.concat(chunks),
    bodySize: total,
  };
}

function validateMultipartMime(bodyBuffer) {
  const bodyText = bodyBuffer.toString("latin1");
  const mimeTypes = [];
  const regex = /Content-Type:\s*([^\r\n]+)/gi;
  let match;

  while ((match = regex.exec(bodyText)) !== null) {
    const mime = match[1].trim().toLowerCase().split(";")[0].trim();

    if (mime === "multipart/form-data") {
      continue;
    }

    mimeTypes.push(mime);
  }

  if (mimeTypes.length === 0) {
    return {
      ok: false,
      reasonCode: "missing_file_content_type",
    };
  }

  for (const mime of mimeTypes) {
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return {
        ok: false,
        reasonCode: "disallowed_content_type",
        mimeType: mime,
      };
    }
  }

  return {
    ok: true,
    reasonCode: "mime_validated",
    mimeTypes,
  };
}

async function handleUploadPost(req, res) {
  const requestDiagnostics = getRequestDiagnostics(req);

  logUploadDiag("post_request_received", requestDiagnostics);

  const authResult = await verifyUploadAuthorization(req);

  logUploadDiag("auth_verification_result", {
    success: authResult.ok,
    reasonCode: authResult.reasonCode,
    walletAddress: authResult.walletAddress,
    ...(authResult.errorName
      ? {
          errorName: authResult.errorName,
          errorMessage: authResult.errorMessage,
          errorCode: authResult.errorCode,
        }
      : {}),
  });

  if (!authResult.ok) {
    sendJson(res, authResult.status, { error: authResult.error });
    return;
  }

  if (!process.env.PINATA_JWT) {
    logUploadError("env_check_failed", {
      reasonCode: "missing_pinata_jwt",
      pinataJwtExists: false,
    });
    sendJson(res, 500, { error: "Upload service unavailable." });
    return;
  }

  const contentType = req.headers["content-type"];

  if (!contentType || !contentType.toLowerCase().startsWith("multipart/form-data")) {
    logUploadWarn("content_type_rejected", {
      reasonCode: "invalid_content_type",
      contentType: contentType ?? "(none)",
    });
    sendJson(res, 400, { error: "Invalid upload content type." });
    return;
  }

  let bodyBuffer;
  let bodySize;

  try {
    const bodyResult = await readBodyWithLimit(req, MAX_BODY_BYTES);
    bodyBuffer = bodyResult.bodyBuffer;
    bodySize = bodyResult.bodySize;
  } catch (error) {
    logUploadError("body_read_failed", {
      reasonCode:
        error?.code === "BODY_TOO_LARGE"
          ? "body_too_large"
          : "body_read_failed",
      ...safeErrorDetails(error),
    });
    throw error;
  }

  logUploadDiag("body_read_complete", {
    reasonCode: "body_read_complete",
    bodySize,
  });

  const mimeCheck = validateMultipartMime(bodyBuffer);

  logUploadDiag("mime_validation_result", {
    success: mimeCheck.ok,
    reasonCode: mimeCheck.reasonCode,
    mimeTypes: mimeCheck.mimeTypes,
    mimeType: mimeCheck.mimeType,
  });

  if (!mimeCheck.ok) {
    sendJson(res, 400, { error: "Unsupported upload file type." });
    return;
  }

  let pinataResponse;

  try {
    pinataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          "Content-Type": contentType,
        },
        body: bodyBuffer,
      }
    );
  } catch (error) {
    logUploadError("pinata_request_failed", {
      reasonCode: "pinata_request_failed",
      ...safeErrorDetails(error),
      bodySize,
    });
    sendJson(res, 502, { error: "Pinata upload failed." });
    return;
  }

  logUploadDiag("pinata_response_received", {
    reasonCode: "pinata_response_received",
    pinataStatus: pinataResponse.status,
    bodySize,
  });

  let data;

  try {
    data = await pinataResponse.json();
  } catch (error) {
    logUploadError("pinata_response_parse_failed", {
      reasonCode: "pinata_response_parse_failed",
      pinataStatus: pinataResponse.status,
      ...safeErrorDetails(error),
      bodySize,
    });
    sendJson(res, 502, { error: "Pinata upload failed." });
    return;
  }

  if (!pinataResponse.ok) {
    logUploadError("pinata_upload_rejected", {
      reasonCode: "pinata_upload_rejected",
      pinataStatus: pinataResponse.status,
      bodySize,
    });
    sendJson(res, 502, { error: "Pinata upload failed." });
    return;
  }

  logUploadDiag("upload_success", {
    reasonCode: "upload_success",
    pinataStatus: pinataResponse.status,
    bodySize,
    hasIpfsHash: Boolean(data?.IpfsHash),
  });

  sendJson(res, 200, {
    IpfsHash: data.IpfsHash,
    PinSize: data.PinSize,
    Timestamp: data.Timestamp,
  });
}

export default async function handler(req, res) {
  const method = req.method ?? "GET";

  try {
    if (method === "OPTIONS") {
      return handleOptionsPreflight(req, res);
    }

    setCorsHeaders(req, res);

    if (method === "GET") {
      return handleCorsDebugGet(req, res);
    }

    if (method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    await handleUploadPost(req, res);
  } catch (error) {
    setCorsHeaders(req, res);
    logUploadError("handler_uncaught_error", {
      reasonCode:
        error?.code === "BODY_TOO_LARGE"
          ? "body_too_large"
          : "handler_uncaught_error",
      method,
      receivedOrigin: getRequestOrigin(req) ?? "(none)",
      ...safeErrorDetails(error),
    });

    if (error?.code === "BODY_TOO_LARGE") {
      return sendJson(res, 413, { error: "Upload exceeds the 2 MB limit." });
    }

    return sendJson(res, 500, { error: "Pinata upload failed." });
  }
}
