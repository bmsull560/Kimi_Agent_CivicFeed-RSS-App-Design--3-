import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface CategoryCardProps {
  category: string;
  count: number;
  icon: ReactNode;
  onClick?: () => void;
}

export default function CategoryCard({ category, count, icon, onClick }: CategoryCardProps) {
  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={onClick}
        className="flex items-center gap-3 p-4 text-left w-full cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
        type="button"
      >
        <div className="flex-shrink-0 size-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {category}
          </h3>
          <p className="text-[0.6875rem] text-slate-500 dark:text-slate-400">{count} feeds</p>
        </div>
      </button>
    </Card>
  );
}
