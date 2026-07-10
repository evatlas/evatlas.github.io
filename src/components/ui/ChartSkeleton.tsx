export default function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div
      className="bg-white rounded-xl border border-border-light p-6 animate-pulse"
      style={{ height }}
    >
      <div className="h-5 w-48 bg-background-alt rounded mb-4" />
      <div className="h-3 w-32 bg-background-alt rounded mb-8" />
      <div className="flex items-end gap-2 h-[60%]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-background-alt rounded-t"
            style={{ height: `${20 + ((i * 37) % 80)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
