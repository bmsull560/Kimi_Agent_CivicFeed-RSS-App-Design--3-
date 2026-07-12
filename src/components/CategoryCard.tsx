import type { ReactNode } from "react";

interface CategoryCardProps {
  category: string;
  count: number;
  icon: ReactNode;
  onClick?: () => void;
}

export default function CategoryCard({ category, count, icon, onClick }: CategoryCardProps) {
  return (
    <button
      onClick={onClick}
      className="card-hover flex items-center gap-3 p-4 text-left w-full cursor-pointer"
      type="button"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-800 truncate">{category}</h3>
        <p className="text-[0.6875rem] text-slate-500">{count} feeds</p>
      </div>
    </button>
  );
}
