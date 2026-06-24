import { BarChart3, ClipboardList, ListChecks, UserRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/work/claim", label: "领取工序", icon: ClipboardList },
  { to: "/work/operations", label: "工序清单", icon: ListChecks },
  { to: "/work/stats", label: "我的统计", icon: BarChart3 },
  { to: "/me", label: "我的", icon: UserRound },
];

export default function MobileLayout() {
  return (
    <div className="mobile-shell">
      <main className="mobile-main"><Outlet /></main>
      <nav className="mobile-nav" aria-label="主要导航">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
