import type { FallbackProps } from "react-error-boundary";

/** Fallback UI rendered when a component inside an ErrorBoundary crashes. */
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col bg-gray-900/55 backdrop-blur-[20px] border border-slate-400/15 rounded-2xl shadow-lg shadow-black/40 overflow-hidden transition-colors hover:border-slate-400/25">
      <div
        className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4"
        id="error-fallback"
      >
        <span className="text-5xl opacity-60">⚠️</span>
        <h2 className="text-[1.1rem] font-semibold">Something went wrong</h2>
        <p className="text-[0.85rem] text-slate-500 max-w-[360px]">
          This component crashed. The rest of the application remains functional.
        </p>
        <p className="font-mono text-[0.75rem] text-slate-500 opacity-70">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <button
          className="mt-2 py-2.5 px-6 bg-blue-500 text-white border-none rounded-xl font-sans text-[0.85rem] font-semibold cursor-pointer transition-all duration-150 shadow-lg shadow-blue-500/20 hover:bg-[#2563eb] hover:-translate-y-px"
          onClick={resetErrorBoundary}
          id="error-retry-button"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
