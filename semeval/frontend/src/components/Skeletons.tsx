/**
 * Shape-matching placeholders shown only on a true cold start (no cached
 * data). They outline the card grid that's about to appear, which reads as
 * considerably faster than a centred "Loading…" line even at identical
 * timings.
 */

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card p-5 flex flex-col gap-3 animate-fade-in"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      <div className="flex flex-col gap-6">
        <div className="glass-card p-8 flex flex-col items-center gap-4">
          <div className="skeleton h-40 w-40 rounded-full" />
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="glass-card p-6 flex flex-col gap-3">
          <div className="skeleton h-3 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-1.5 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2 flex flex-col gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card p-6 flex flex-col gap-3">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
