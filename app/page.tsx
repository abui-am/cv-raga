import { Entry } from "@/components/entry";
import { AuthGate } from "@/components/auth-gate";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthGate>
        <Entry />
      </AuthGate>
    </Suspense>
  );
}

// Session redirects depend on the current request.
export const instant = false;
