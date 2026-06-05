import { type ReactNode, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface LayoutProps { children: ReactNode; }

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 p-4 lg:p-6" role="main" aria-label="Main content">{children}</main>
      </div>
    </div>
  );
}
