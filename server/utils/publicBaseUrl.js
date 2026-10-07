/**
 * Resolves the public HTTPS base URL Twilio must use to fetch TwiML webhooks.
 *
 * Common failure mode: PUBLIC_BASE_URL set to a dead/placeholder Vercel host
 * (e.g. smartcare-ai-server.vercel.app → DEPLOYMENT_NOT_FOUND). Twilio then
 * reports that the TwiML application URL is unreachable.
 */

const LIVE_BACKEND_FALLBACK = "https://smart-care-ai-a33e.vercel.app";

const UNREACHABLE_HOST_FRAGMENTS = [
  "ngrok-free.dev",
  "ngrok.io",
  "localhost",
  "127.0.0.1",
  // Placeholder / retired project names from older docs — not the live deploy
  "smartcare-ai-server.vercel.app",
  "your-backend-project.vercel.app",
];

function isUnreachableBaseUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return UNREACHABLE_HOST_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

/**
 * @param {import("express").Request} [req] - Optional request; when present, prefer
 *   the host Twilio (or the client) actually hit so Gather action URLs stay on the
 *   live deployment even if env is stale.
 */
function getPublicBaseUrl(req) {
  // Prefer the inbound request host when it is a real public host. This makes
  // Gather callbacks self-healing on the deployment that received /twiml.
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) {
      const fromReq = normalizeBaseUrl(`${proto}://${host}`);
      if (!isUnreachableBaseUrl(fromReq)) {
        return fromReq;
      }
    }
  }

  const envUrl = normalizeBaseUrl(process.env.PUBLIC_BASE_URL);
  if (envUrl && !isUnreachableBaseUrl(envUrl)) {
    return envUrl;
  }

  return LIVE_BACKEND_FALLBACK;
}

module.exports = {
  getPublicBaseUrl,
  LIVE_BACKEND_FALLBACK,
  isUnreachableBaseUrl,
};
