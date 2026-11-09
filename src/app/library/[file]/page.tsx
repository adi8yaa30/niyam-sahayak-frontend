import { Suspense } from "react";
import DocDetail from "@/components/library/DocDetail";

export const metadata = { title: "Document · Niyam Sahayak" };

export default function DocumentPage({ params }: PageProps<"/library/[file]">) {
  return (
    <Suspense fallback={<p className="px-6 py-10 text-ink-3" role="status">Loading document…</p>}>
      <DocDetail params={params} />
    </Suspense>
  );
}
