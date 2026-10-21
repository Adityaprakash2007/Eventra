import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton matching the EventCard layout. */
export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 shadow-[var(--shadow-card)]">
      <Skeleton className="h-52 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-2 w-full" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </div>
    </div>
  );
}

/** Row of 4 dashboard stat card skeletons. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton matching an admin table with `rows` rows. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-32 sm:block" />
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Full-width chart placeholder skeleton. */
export function ChartSkeleton({ className = "h-72" }: { className?: string }) {
  return (
    <div className={`flex items-end gap-3 px-4 pb-2 ${className}`}>
      {[45, 70, 35, 85, 60, 90, 50, 75, 40, 65, 80, 55].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
