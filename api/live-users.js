/**
 * Vercel Serverless Function: Real-Time Concurrent Viewers via Upstash Redis REST API
 * Works natively on Vercel with either Upstash Redis (`UPSTASH_REDIS_REST_*`)
 * or Vercel KV (`KV_REST_API_*`) environment variables, with zero npm dependencies.
 */

const REDIS_KEY = 'chicks:live_viewers';
const ACTIVE_WINDOW_MS = 45000; // 45s sliding window (client heartbeats every 15s)
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function parseRequestBody(req) {
  if (!req.body) return {};
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(JSON.stringify(payload));
}

async function runRedisPipeline(redisUrl, redisToken, commands) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(`${redisUrl.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Upstash HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // Gracefully report unconfigured state before Upstash Redis is linked on Vercel
  if (!redisUrl || !redisToken) {
    sendJson(res, 200, { configured: false, count: null });
    return;
  }

  const now = Date.now();
  const cutoff = now - ACTIVE_WINDOW_MS;
  const body = parseRequestBody(req);
  const rawSessionId = body.sessionId || req.query?.sessionId || '';
  const sessionId = SESSION_ID_RE.test(rawSessionId) ? rawSessionId : null;
  const action = body.action === 'leave' ? 'leave' : 'ping';

  try {
    let count = 0;

    if (req.method === 'POST' && sessionId && action === 'leave') {
      const results = await runRedisPipeline(redisUrl, redisToken, [
        ['ZREM', REDIS_KEY, sessionId],
        ['ZREMRANGEBYSCORE', REDIS_KEY, 0, cutoff],
        ['ZCARD', REDIS_KEY]
      ]);
      count = Number(results[2]?.result ?? 0);
    } else if (req.method === 'POST' && sessionId) {
      const results = await runRedisPipeline(redisUrl, redisToken, [
        ['ZREMRANGEBYSCORE', REDIS_KEY, 0, cutoff],
        ['ZADD', REDIS_KEY, now, sessionId],
        ['ZCARD', REDIS_KEY],
        ['EXPIRE', REDIS_KEY, 120]
      ]);
      count = Math.max(1, Number(results[2]?.result ?? 1));
    } else {
      const results = await runRedisPipeline(redisUrl, redisToken, [
        ['ZREMRANGEBYSCORE', REDIS_KEY, 0, cutoff],
        ['ZCARD', REDIS_KEY]
      ]);
      count = Number(results[1]?.result ?? 0);
    }

    sendJson(res, 200, { configured: true, count });
  } catch (err) {
    sendJson(res, 502, { configured: true, error: true, count: null });
  }
};
