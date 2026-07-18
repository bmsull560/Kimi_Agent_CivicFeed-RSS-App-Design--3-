import { useNavigate } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-4">
        <AlertTriangle size={28} />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        The page you’re looking for doesn’t exist. Check the URL or return to the dashboard.
      </p>
      <button onClick={() => navigate("/")} className="btn-primary" type="button">
        <Home size={16} /> Back to Dashboard
      </button>
    </div>
  );
}
