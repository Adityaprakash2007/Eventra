import { Ticket, Github, Twitter, Linkedin, Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const quickLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/events", label: "Events" },
  { to: "/register", label: "Register" },
  { to: "/payment", label: "Payment" },
];

const socials = [
  { icon: Twitter, label: "Twitter", href: "https://twitter.com" },
  { icon: Github, label: "GitHub", href: "https://github.com" },
  { icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com" },
  { icon: Instagram, label: "Instagram", href: "https://instagram.com" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/60">
      <div className="container py-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
                <Ticket className="h-5 w-5" />
              </div>
              <span className="text-base font-semibold">Eventra</span>
            </Link>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Registration &amp; ticketing for modern events — discover, register and pay in seconds.
            </p>
          </div>

          {/* Quick links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {quickLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Socials */}
          <div className="flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:shadow-glow-sm"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-5 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Eventra. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">Crafted for seamless event experiences.</p>
        </div>
      </div>
    </footer>
  );
}
