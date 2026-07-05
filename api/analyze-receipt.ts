import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProvider, toProcessedReceipt } from "../lib/ai/index.js";
import { verifyUser, makeRateLimiter } from "../lib/server/googleAuth.js";
import { isEmailAllowed } from "../lib/server/db.js";

// Allow base64 image payloads. The client downscales to ~1600px JPEG (well
// under 1MB), so 5mb is already generous headroom; keep it low because the
// whole body is buffered into memory before any size check runs.
export const config = {
  api: {
    bodyParser: { sizeLimit: "5mb" },
  },
};

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024; // decoded cap, coherent with the 5mb base64 body limit

const rateLimited = makeRateLimiter(15, 60_000);

// Allowed when either the ALLOWED_EMAILS env var (bootstrap/owner override,
// also the fallback when the DB is down) or the access_requests table says so.
async function isAllowed(email: string): Promise<boolean> {
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.includes(email)) return true;
  return isEmailAllowed(email);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  // 1. Authenticate
  const user = await verifyUser(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  const { email } = user;
  if (!(await isAllowed(email))) {
    // `code` lets the client tell "not on the list" apart from other failures
    // and offer the waitlist instead of a generic error.
    return res.status(403).json({ error: "Your account doesn't have access yet.", code: "not_allowlisted" });
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
