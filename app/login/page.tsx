import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth";

async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session) redirect("/career");
  return <LoginForm expired={Boolean((await searchParams).error)} />;
}
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-6">Loading sign-in…</p>}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

// Session redirects depend on the current request.
export const instant = false;
