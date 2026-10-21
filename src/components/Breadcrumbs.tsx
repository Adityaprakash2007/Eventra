import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const labelMap: Record<string, string> = {
  events: "Events",
  register: "Register",
  payment: "Payment",
  admin: "Admin",
  login: "Login",
  signup: "Signup",
};

export default function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Link to="/" className="flex items-center gap-1 transition-colors hover:text-foreground">
        <Home className="h-3 w-3" />
        Home
      </Link>
      {segments.map((seg, i) => {
        const to = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={to} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 opacity-60" />
            {isLast ? (
              <span className="font-medium text-foreground">{labelMap[seg] ?? seg}</span>
            ) : (
              <Link to={to} className="transition-colors hover:text-foreground">
                {labelMap[seg] ?? seg}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
