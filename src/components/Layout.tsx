import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationCenter";
import UserMenu from "@/components/UserMenu";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, CalendarDays, UserPlus, CreditCard, Shield, Ticket, ScanLine, Users, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/tickets", label: "My Tickets", icon: Ticket },
  { to: "/register", label: "Register", icon: UserPlus },
  { to: "/payment", label: "Payment", icon: CreditCard },
  { to: "/organizer", label: "Organizer", icon: Users },
  { to: "/scanner", label: "Scanner", icon: ScanLine },
  { to: "/admin", label: "Admin", icon: Shield },
];

const publicNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/login", label: "Sign in", icon: UserPlus },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isAdmin } = useAuth();
  const location = useLocation();
  // Admin link only for admins; everything else for logged-in users
  const items = isLoggedIn ? nav.filter((n) => n.to !== "/admin" || isAdmin) : publicNav;
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Eventra</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Registration &amp; Ticketing</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden md:flex items-center gap-1">
              {items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className="group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  activeClassName={cn(
                    "bg-accent text-accent-foreground",
                    // gradient bottom accent for the active item
                    "after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-gradient-primary"
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              ))}
            </nav>
            {isLoggedIn && <NotificationBell />}
            <ThemeToggle />
            {isLoggedIn ? (
              <UserMenu />
            ) : (
              <NavLink
                to="/login"
                className="flex items-center rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant transition-opacity hover:opacity-90"
              >
                Sign in
              </NavLink>
            )}
          </div>
        </div>
        {/* Mobile nav — pill with gradient active state */}
        <nav className="border-t border-border/60 bg-card/60 md:hidden">
          <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto px-2 py-2">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-all"
                activeClassName="bg-gradient-primary text-primary-foreground shadow-glow-sm"
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="container flex-1 py-8">
        <Breadcrumbs />
        {children}
      </main>

      <Footer />
    </div>
  );
}
