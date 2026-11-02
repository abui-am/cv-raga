import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { Suspense, type ReactNode } from "react";
import { Loading } from "@/components/ui";
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AuthGate>
        <Shell>{children}</Shell>
      </AuthGate>
    </Suspense>
  );
}

// Session redirects depend on the current request.
export const instant = false;
