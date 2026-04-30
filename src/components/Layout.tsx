import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LayoutDashboard, CalendarDays, UserPlus, CreditCard, Shield, Ticket } from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/register", label: "Register", icon: UserPlus },
  { to: "/payment", label: "Payment", icon: CreditCard },
  { to: "/admin", label: "Admin", icon: Shield },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Eventra</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Registration & Ticketing</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden md:flex items-center gap-1">
              {nav.map(n => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  activeClassName="bg-accent text-accent-foreground"
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
        <nav className="md:hidden border-t border-border/60 overflow-x-auto">
          <div className="flex items-center gap-1 px-2 py-2">
            {nav.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                activeClassName="bg-accent text-accent-foreground"
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}

