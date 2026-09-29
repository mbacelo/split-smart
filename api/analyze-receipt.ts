import { getProvider, toProcessedReceipt } from "../lib/ai/index.js";
import { verifyUser, makeRateLimiter } from "../lib/server/googleAuth.js";
import { isEmailAllowed } from "../lib/server/db.js";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
// The client downscales to ~1600px JPEG (well under 1MB), so this is generous
// headroom. Decoded cap; as base64 (~4MB) it stays under Vercel's 4.5MB body limit.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

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

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    // 1. Authenticate
    const user = await verifyUser(req.headers.get("authorization"));
    if (!user) {
      return Response.json({ error: "Sign in to continue." }, { status: 401 });
    }
    const { email } = user;
    if (!(await isAllowed(email))) {
      // `code` lets the client tell "not on the list" apart from other failures
      // and offer the waitlist instead of a generic error.
      return Response.json({ error: "Your account doesn't have access yet.", code: "not_allowlisted" }, { status: 403 });
    }
    if (rateLimited(email)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    // 2. Validate input
    const body = await req.json().catch(() => null);
    const imageBase64 = body?.imageBase64 ?? "";
    const mimeMatch = typeof imageBase64 === "string" && imageBase64.match(/^data:([^;]+);base64,/);
    if (!mimeMatch) {
      return Response.json({ error: "Expected a base64 image data URL." }, { status: 400 });
    }
    const mimeType = mimeMatch[1];
    if (!ALLOWED_MIME.includes(mimeType.toLowerCase())) {
      return Response.json({ error: "Unsupported image type." }, { status: 400 });
    }
    const cleanBase64 = imageBase64.split(",")[1] || "";
    // base64 expands bytes by ~4/3; check decoded size.
    if ((cleanBase64.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image too large." }, { status: 413 });
    }

    // 3. Call provider + return the app's ProcessedReceipt shape
    try {
      const raw = await getProvider().analyzeReceipt(cleanBase64, mimeType);
      return Response.json(toProcessedReceipt(raw));
    } catch (err) {
      // Never leak provider errors / keys to the client.
      console.error("Analysis error:", err);
      return Response.json({ error: "Failed to analyze receipt. Try a clearer photo." }, { status: 502 });
    }
  },
};
