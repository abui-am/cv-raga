"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/queries";
import { buttonClass, ErrorNotice, Loading } from "./ui";
export function Entry() {
  const profile = useQuery(queries.profile.detail);
  const router = useRouter();
  useEffect(() => {
    if (profile.isSuccess)
      router.replace(profile.data ? "/applications" : "/career");
  }, [profile.isSuccess, profile.data, router]);
  return (
    <main className="mx-auto max-w-reading p-8">
      <h1 className="text-2xl font-semibold">cvraga.</h1>
      {profile.isError ? (
        <>
          <ErrorNotice error={profile.error} />
          <Link
            href="/career"
            className={`${buttonClass} bg-primary text-white`}
          >
            Open workspace
          </Link>
        </>
      ) : (
        <Loading label="Opening your workspace…" />
      )}
    </main>
  );
}
