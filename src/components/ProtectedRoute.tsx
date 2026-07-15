import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userEmail = localStorage.getItem("mock_user_email");
    if (userEmail) {
      setIsAuthenticated(true);
    } else {
      navigate("/");
    }
    setLoading(false);
  }, [navigate]);

  if (loading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-emerald-400">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : null;
}
