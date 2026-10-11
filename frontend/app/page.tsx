export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Field Shift</h1>
      <p className="text-lg text-center max-w-2xl">
        Rotate smarter. Build soil. Adapt with NASA data.
      </p>
      <div className="mt-8 space-x-4">
        <a href="/setup" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Open a sample farm
        </a>
        <a href="/setup" className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Pin my field
        </a>
      </div>
    </main>
  );
}