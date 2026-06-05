import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps { message: string; subMessage?: string; icon?: ReactNode; action?: { label: string; onClick: () => void }; }

export default function EmptyState({ message, subMessage, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">{icon || <Inbox size={28} />}</div>
      <p className="text-base font-medium text-slate-700">{message}</p>
      {subMessage && <p className="text-sm text-slate-500 mt-1 max-w-sm">{subMessage}</p>}
      {action && <button onClick={action.onClick} className="btn-primary mt-4" type="button">{action.label}</button>}
    </div>
  );
}
