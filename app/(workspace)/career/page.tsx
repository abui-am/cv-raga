import { CareerPage } from "@/features/career/career-page";
import { Suspense } from "react";
import { Loading } from "@/components/ui";

async function CareerRoute({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  return (
    <CareerPage
      initialSection={
        section === "evidence"
          ? "evidence"
          : section === "history"
            ? "history"
            : "details"
      }
    />
  );
}

export default function Page(props: {
  searchParams: Promise<{ section?: string }>;
}) {
  return (
    <Suspense fallback={<Loading label="Opening your career…" />}>
      <CareerRoute {...props} />
    </Suspense>
  );
}
