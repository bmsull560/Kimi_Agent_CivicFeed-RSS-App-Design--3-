interface LoadingStateProps { count?: number; type?: "card" | "list-item" | "kpi"; }

export default function LoadingState({ count = 3, type = "list-item" }: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  if (type === "kpi") return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(i => <div key={i} className="card p-4"><div className="skeleton h-10 w-10 rounded-lg mb-3" /><div className="skeleton h-4 w-3/4 mb-2" /><div className="skeleton h-3 w-1/2" /></div>)}
    </div>
  );
  if (type === "card") return (
    <div className="grid gap-4">
      {items.map(i => <div key={i} className="card p-4"><div className="skeleton h-4 w-3/4 mb-3" /><div className="skeleton h-3 w-full mb-2" /><div className="skeleton h-3 w-2/3" /></div>)}
    </div>
  );
  return (
    <div className="divide-y divide-slate-100">
      {items.map(i => <div key={i} className="py-4"><div className="skeleton h-4 w-3/4 mb-2" /><div className="flex gap-2 mt-2"><div className="skeleton h-3 w-16 rounded-full" /><div className="skeleton h-3 w-12" /></div></div>)}
    </div>
  );
}
