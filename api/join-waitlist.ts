import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyUser, makeRateLimiter } from "../lib/server/googleAuth.js";
import { isDbConfigured, upsertWaitlistRequest } from "../lib/server/db.js";

// Joining requires a verified Google sign-in, so every waitlist row is a real,
// verified email — the list can't be spammed with made-up addresses.

const rateLimited = makeRateLimiter(3, 60_000);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const user = await verifyUser(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  if (rateLimited(user.email)) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  if (!isDbConfigured()) {
    console.error("join-waitlist called but DATABASE_URL is not set.");
    return res.status(503).json({ error: "The waitlist isn't available right now. Please try again later." });
  }

  try {
    const status = await upsertWaitlistRequest(user.email, user.name);
    return res.status(200).json({ status });
  } catch (err) {
    // Never leak DB errors/connection strings to the client.
    console.error("Waitlist error:", err);
    return res.status(502).json({ error: "Couldn't save your request. Please try again later." });
  }
}
