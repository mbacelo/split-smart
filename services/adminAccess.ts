import { getIdToken } from "./auth";
import { ApiError } from "./receiptService";

// Client for the admin-only /api/access-requests endpoint. Every call is
// authorized server-side against ADMIN_EMAILS; a non-admin just gets a 403.

export type AccessStatus = "waitlisted" | "allowed";

export interface AccessRequest {
  email: string;
  name: string | null;
  status: AccessStatus;
  requestedAt: string;
  approvedAt: string | null;
}

async function request<T>(init: RequestInit, fallbackMessage: string): Promise<T> {
  const token = getIdToken();
  if (!token) throw new Error("Please sign in to manage access.");

  const res = await fetch("/api/access-requests", {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let message = fallbackMessage;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

/** Every access request. A 403 here is the signal that the caller isn't an
 * admin — see hooks/useAdmin.ts. */
export const listAccessRequests = async (): Promise<AccessRequest[]> => {
  const data = await request<{ requests: AccessRequest[] }>({ method: "GET" }, "Couldn't load access requests.");
  return data.requests;
};

const post = (body: Record<string, unknown>, fallbackMessage: string) =>
  request<{ request: AccessRequest }>(
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    fallbackMessage,
  ).then((data) => data.request);

/** Approve ('allowed') or revoke ('waitlisted') an existing request. */
export const setAccessStatus = (email: string, status: AccessStatus): Promise<AccessRequest> =>
  post({ action: "set-status", email, status }, "Couldn't update access. Please try again.");

/** Grant access to an email directly, waitlisted or not. */
export const grantAccess = (email: string): Promise<AccessRequest> =>
  post({ action: "grant", email }, "Couldn't grant access. Please try again.");
