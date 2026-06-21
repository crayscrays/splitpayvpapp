import { NavLink } from "react-router-dom";
import { Home, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/groups", label: "Groups", icon: Users, end: false },
  { to: "/wallet", label: "Account", icon: User, end: false },
];

export function BottomNav() {
  return (
    <nav
      className="shrink-0 bg-surface border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors",
                isActive ? "text-accent" : "text-text-muted hover:text-text"
              )
            }
            data-testid={`nav-${label.toLowerCase()}`}
          >
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
