import { getIdToken } from "./auth";
import { ApiError } from "./receiptService";

export type WaitlistStatus = "joined" | "already_waitlisted" | "already_allowed";

/**
 * Ask the server to put the signed-in user on the access waitlist. The server
 * verifies the Google token, so the stored email is always real and verified.
 */
export const joinWaitlist = async (): Promise<WaitlistStatus> => {
  const token = getIdToken();
  if (!token) throw new Error("Please sign in to join the waitlist.");

  const res = await fetch("/api/join-waitlist", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let message = "Couldn't join the waitlist. Please try again later.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(message, res.status);
  }

  const data = (await res.json()) as { status: WaitlistStatus };
  return data.status;
};
