function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <SkeletonBox className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-6 py-4">
                  <SkeletonBox className={`h-4 ${colIdx === 0 ? 'w-32' : 'w-20'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BookingsListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 flex justify-between items-center">
          <div className="space-y-2 flex-1">
            <SkeletonBox className="h-5 w-40" />
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-4 w-64" />
          </div>
          <SkeletonBox className="h-5 w-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function InventoryPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Action buttons skeleton */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex gap-4 mb-6">
            <SkeletonBox className="h-10 w-36" />
            <SkeletonBox className="h-10 w-52" />
          </div>
          {/* Search filters skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <SkeletonBox className="h-3 w-16 mb-1" />
                <SkeletonBox className="h-10 w-full" />
              </div>
            ))}
          </div>
          {/* Table skeleton */}
          <TableSkeleton />
        </div>
      </div>
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    </div>
  );
}
