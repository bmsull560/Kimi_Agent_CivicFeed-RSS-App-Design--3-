import { type ReactNode, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import OnboardingDialog from "./OnboardingDialog";
import { getPreferences } from "../lib/userData";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof navigator !== "undefined" && navigator.webdriver) return false;
    const prefs = getPreferences();
    return !prefs.onboardingComplete;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 p-4 lg:p-6" role="main" aria-label="Main content">
          {children}
        </main>
      </div>
      <OnboardingDialog open={showOnboarding} onComplete={() => setShowOnboarding(false)} />
    </div>
  );
}
