"use client";
import { useState, type FormEvent } from "react";
import { FileText, Mail, ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ expired = false }: { expired?: boolean }) {
  const [method, setMethod] = useState<"password" | "link">(
    expired ? "link" : "password",
  );
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (method === "password") {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error)
          setError(
            "The email or password is incorrect. Try again or use an email link.",
          );
        else {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Start with a fresh workspace cache after authentication.
          window.location.assign("/career");
        }
      } else {
        const result = await authClient.signIn.magicLink({
          email: email.trim(),
          callbackURL: "/career",
          errorCallbackURL: "/login?error=expired",
        });
        if (result.error)
          setError(
            "We couldn’t send your sign-in link. Please try again in a minute.",
          );
        else setSent(true);
      }
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 text-xl font-semibold tracking-tight">
          <span className="flex size-10 items-center justify-center rounded-control bg-primary text-primary-foreground">
            <FileText aria-hidden="true" size={22} />
          </span>
          <span>
            cvraga<span className="text-primary">.</span>
          </span>
        </div>
        <section className="rounded-panel border border-border bg-card p-6 md:p-8">
          <Mail className="mb-5 text-primary" size={28} aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight">
            {sent ? "Check your inbox" : "Your next chapter starts here"}
          </h1>
          {sent ? (
            <div role="status" className="mt-4 space-y-5">
              <p className="leading-relaxed text-muted-foreground">
                We sent a sign-in link to{" "}
                <strong className="break-all text-foreground">
                  {email.trim()}
                </strong>
                . It expires in 10 minutes. Check your spam folder too.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="min-h-control text-sm font-semibold text-primary underline underline-offset-4"
              >
                Use another email or send again
              </button>
            </div>
          ) : (
            <>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Sign in to your private workspace. New here? Use an email link
                to create your account.
              </p>
              {expired && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  This sign-in link has expired or was already used. Request a
                  new one below.
                </p>
              )}
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby={error ? "login-error" : undefined}
                    className="min-h-control w-full rounded-control border border-input bg-card px-3 py-2 text-base focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
                    placeholder="you@example.com"
                  />
                </div>
                {method === "password" && (
                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-medium"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={128}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-describedby={error ? "login-error" : undefined}
                      className="min-h-control w-full rounded-control border border-input bg-card px-3 py-2 text-base focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
                    />
                  </div>
                )}
                {error && (
                  <p
                    id="login-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}
                <button
                  disabled={pending}
                  className="flex min-h-control w-full items-center justify-center gap-2 rounded-control bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  {pending
                    ? method === "password"
                      ? "Signing in…"
                      : "Sending link…"
                    : method === "password"
                      ? "Sign in"
                      : "Email me a sign-in link"}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </form>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMethod(method === "password" ? "link" : "password");
                  setError("");
                  setPassword("");
                }}
                className="mt-4 min-h-control text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:opacity-50"
              >
                {method === "password"
                  ? "Use an email link instead"
                  : "Sign in with a password"}
              </button>
            </>
          )}
        </section>
        <p className="mt-6 text-sm text-muted-foreground">
          A better fit. Still your story.
        </p>
      </div>
    </main>
  );
}
