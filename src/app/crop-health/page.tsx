import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AnalysisSession from "@/components/AnalysisSession";

export default function CropHealthPage() {
  return (
    <main className="min-h-dvh bg-slate-300 text-black">
      <div className="mx-auto flex max-w-4xl items-center px-4 pt-5 sm:px-6 ">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-lime-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-lime-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-800"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Chash Orbit
        </Link>
      </div>
      <AnalysisSession />
    </main>
  );
}
