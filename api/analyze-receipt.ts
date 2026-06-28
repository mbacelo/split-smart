import type { VercelRequest, VercelResponse } from "@vercel/node";
import { OAuth2Client } from "google-auth-library";
import { getProvider, toProcessedReceipt } from "../lib/ai/index.js";

// Allow base64 image payloads (a photo can be a few MB once base64-encoded).
export const config = {
  api: {
    bodyParser: { sizeLimit: "8mb" },
  },
};

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~6MB of decoded image

// Naive in-memory per-email throttle. Resets on cold start — good enough behind
// the email allowlist; not a substitute for a real limiter at scale.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;
const hits = new Map<string, number[]>();

const googleClient = new OAuth2Client();

function rateLimited(email: string): boolean {
  const now = Date.now();
  const recent = (hits.get(email) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(email, recent);
  return recent.length > RATE_MAX;
}

/** Verifies the Google ID token and returns the verified email, or null. */
async function verifyUser(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice("Bearer ".length).trim();
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) return null;
    return payload.email.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowed(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  // 1. Authenticate
  const email = await verifyUser(req.headers.authorization);
  if (!email) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  if (!isAllowed(email)) {
    return res.status(403).json({ error: "Your account is not on the allowlist." });
  }
  if (rateLimited(email)) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  // 2. Validate input
  const imageBase64 = (req.body?.imageBase64 ?? "") as string;
  const mimeMatch = typeof imageBase64 === "string" && imageBase64.match(/^data:([^;]+);base64,/);
  if (!mimeMatch) {
    return res.status(400).json({ error: "Expected a base64 image data URL." });
  }
  const mimeType = mimeMatch[1];
  if (!ALLOWED_MIME.includes(mimeType.toLowerCase())) {
    return res.status(400).json({ error: "Unsupported image type." });
  }
  const cleanBase64 = imageBase64.split(",")[1] || "";
  // base64 expands bytes by ~4/3; check decoded size.
  if ((cleanBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: "Image too large." });
  }

  // 3. Call provider + return the app's ProcessedReceipt shape
  try {
    const raw = await getProvider().analyzeReceipt(cleanBase64, mimeType);
    return res.status(200).json(toProcessedReceipt(raw));
  } catch (err) {
    // Never leak provider errors / keys to the client.
    console.error("Analysis error:", err);
    return res.status(502).json({ error: "Failed to analyze receipt. Try a clearer photo." });
  }
}
