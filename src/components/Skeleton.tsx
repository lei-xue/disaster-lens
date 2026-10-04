export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-md bg-slate-200 ${className}`} />
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <SkeletonBlock className="h-80" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-80" />
        <SkeletonBlock className="h-80" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} className="h-10" />
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <SkeletonBlock className="h-5 w-44" />
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex gap-2">
          <SkeletonBlock className="h-6 w-40 rounded-full" />
          <SkeletonBlock className="h-6 w-24 rounded-full" />
        </div>
        <SkeletonBlock className="h-8 w-3/4" />
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-10" />
          ))}
          <SkeletonBlock className="h-16 sm:col-span-2" />
        </div>
      </div>
    </div>
  )
}
