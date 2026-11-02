"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/http";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        retry: (count, error) =>
          count < 1 &&
          error.name !== "AbortError" &&
          (!(error instanceof ApiError) || error.status >= 500),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
let browserClient: QueryClient | undefined;
export function Providers({ children }: { children: ReactNode }) {
  const client =
    typeof window === "undefined"
      ? makeQueryClient()
      : (browserClient ??= makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
