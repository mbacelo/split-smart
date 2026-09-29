import { verifyUser, makeRateLimiter } from "../lib/server/googleAuth.js";
import { isDbConfigured, upsertWaitlistRequest } from "../lib/server/db.js";

// Joining requires a verified Google sign-in, so every waitlist row is a real,
// verified email — the list can't be spammed with made-up addresses.

const rateLimited = makeRateLimiter(3, 60_000);

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    const user = await verifyUser(req.headers.get("authorization"));
    if (!user) {
      return Response.json({ error: "Sign in to continue." }, { status: 401 });
    }
    if (rateLimited(user.email)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    if (!isDbConfigured()) {
      console.error("join-waitlist called but DATABASE_URL is not set.");
      return Response.json({ error: "The waitlist isn't available right now. Please try again later." }, { status: 503 });
    }

    try {
      const status = await upsertWaitlistRequest(user.email, user.name);
      return Response.json({ status });
    } catch (err) {
      // Never leak DB errors/connection strings to the client.
      console.error("Waitlist error:", err);
      return Response.json({ error: "Couldn't save your request. Please try again later." }, { status: 502 });
    }
  },
};
