import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Client-side guard for admin-only routes. The real protection is server-side
 * (requireAdmin middleware on the API); this just keeps non-admins out of the
 * admin UI and redirects them instead of rendering a broken page.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoggedIn, isAdmin } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
