import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AnalysisSession from "@/components/AnalysisSession";

export default function CropHealthPage() {
  return (
    <main className="min-h-dvh bg-slate-300 text-black">
      <div className="mx-auto flex max-w-4xl items-center px-4 pt-5 sm:px-6 ">
        <button className="bg-lime-600 text-white rounded-2xl hover:bg-lime-500 font-semibold">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4 " />
            Back to Chash Orbit
          </Link>
        </button>
      </div>
      <AnalysisSession />
    </main>
  );
}
