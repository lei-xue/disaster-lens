import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  hint?: string
  children?: ReactNode
}

export default function EmptyState({ title, hint, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-10 w-10 text-slate-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 7h18M3 12h18M3 17h10" strokeLinecap="round" />
      </svg>
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {hint ? <p className="max-w-md text-sm text-slate-500">{hint}</p> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}
