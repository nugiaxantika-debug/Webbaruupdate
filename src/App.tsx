import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Settings } from "lucide-react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const [maintenance, setMaintenance] = useState<{ isMaintenance: boolean; message: string; image: string } | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const currentUserEmail = localStorage.getItem("mock_user_email");
  const isAdmin = currentUserEmail === "nugiaxantika@gmail.com" || currentUserEmail === "jujqkqpenolimako@gmail.com";

  useEffect(() => {
    const fetchMaintenanceAndStatus = async () => {
      try {
        const apiBaseURL = import.meta.env.VITE_APP_URL || window.location.origin;
        
        const res = await fetch(`${apiBaseURL}/api/config`);
        const data = await res.json();
        
        if (data && data.config) {
          setMaintenance({
            isMaintenance: data.config.maintenanceMode || false,
            message: data.config.maintenanceMessage || "Sistem sedang dalam perbaikan. Kami akan segera kembali.",
            image: data.config.maintenanceImage || ""
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsChecking(false);
      }
    };
    fetchMaintenanceAndStatus();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-neutral-800 border-t-emerald-500 animate-spin mb-4"></div>
        <p className="text-neutral-500 text-sm font-medium">Memuat sistem...</p>
      </div>
    );
  }

  if (maintenance?.isMaintenance && !isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-xl flex flex-col items-center">
          {maintenance.image ? (
            <img src={maintenance.image} alt="Maintenance" className="w-48 h-48 object-cover mb-6 rounded-2xl" />
          ) : (
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
              <Settings className="w-12 h-12 text-rose-500 animate-spin-slow" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-4">Sistem Dalam Perbaikan</h1>
          <p className="text-neutral-400 mb-8 whitespace-pre-wrap">{maintenance.message || "Sistem sedang dalam perbaikan. Kami akan segera kembali."}</p>
          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
             <div className="h-full bg-rose-500 w-1/2 animate-pulse mx-auto rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
