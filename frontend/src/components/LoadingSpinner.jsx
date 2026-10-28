import { Loader2 } from 'lucide-react';

/**
 * Reusable loading spinner component with optional message.
 */
export default function LoadingSpinner({ message = 'Loading...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

/**
 * Skeleton placeholder for loading states.
 */
export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-4 space-y-3">
      <SkeletonBlock className="h-4 w-3/4" />
      <SkeletonBlock className="h-3 w-1/2" />
      <SkeletonBlock className="h-20 w-full" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-6 w-16 rounded-full" />
        <SkeletonBlock className="h-6 w-20 rounded-full" />
        <SkeletonBlock className="h-6 w-14 rounded-full" />
      </div>
    </div>
  );
}
