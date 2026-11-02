"use client";
import Link from "next/link";
import { SignOut } from "./sign-out";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  FileText,
  ScanText,
  UserRound,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/queries";
import type { ReactNode } from "react";

const navigation = [
  { href: "/career", label: "My career", icon: UserRound },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/cvs", label: "My CVs", icon: FileText },
  { href: "/ats", label: "ATS Check", icon: ScanText },
];
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const settings = useQuery(queries.settings.detail);
  const page = navigation.find((n) => pathname.startsWith(n.href));
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-primary p-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="flex flex-col border-b border-border bg-card lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0">
        <Link
          href="/"
          className="flex h-20 items-center gap-3 px-6"
          aria-label="CVRaga home"
        >
          <span className="flex size-9 items-center justify-center rounded-control bg-primary text-primary-foreground">
            <FileText size={21} aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            cvraga<span className="text-primary">.</span>
          </span>
        </Link>
        <div className="hidden px-6 pb-4 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground lg:block">
          Your workspace
        </div>
        <nav
          aria-label="Main navigation"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-4"
        >
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              className={`flex min-h-control shrink-0 items-center gap-3 rounded-control px-3 py-3 text-sm font-medium ${pathname.startsWith(href) ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden p-4 lg:block">
          <div className="rounded-panel bg-background p-4">
            <ShieldCheck
              size={18}
              aria-hidden="true"
              className="mb-3 text-primary"
            />
            <p className="text-xs font-semibold">Your private workspace.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Your documents belong to your account. AI actions send the
              relevant text to OpenAI.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${settings.data?.aiConfigured ? "bg-primary" : "bg-muted-foreground"}`}
            />
            {settings.isError
              ? "Database unavailable"
              : settings.data?.aiConfigured
                ? "AI connected"
                : "AI key not configured"}
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 text-xs text-muted-foreground md:px-8">
          <div className="flex items-center gap-2">
            <span>Workspace</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="font-medium text-foreground">
              {page?.label || "Welcome"}
            </span>
          </div>
          <SignOut />
        </header>
        <main
          id="main"
          className="mx-auto max-w-app px-4 py-8 md:px-8 md:py-10"
        >
          {children}
        </main>
        <footer className="px-4 pb-6 text-xs text-muted-foreground md:px-8">
          A better fit. Still your story.
        </footer>
      </div>
    </div>
  );
}
