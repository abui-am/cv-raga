"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export function SignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {error && <span role="alert">Please try again.</span>}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error("Sign out failed");
            // Full navigation discards all cached workspace data before another sign-in.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Clear all in-memory workspace state when accounts change.
            window.location.assign("/login");
          } catch {
            setError(true);
            setPending(false);
          }
        }}
        className="min-h-control rounded-control px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring disabled:opacity-50"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
