import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  FileClock,
  Gauge,
  Menu,
  Settings,
  ShieldCheck,
  Upload,
  UserCog,
  UserPlus,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { canAccessAdminRoute, type AdminRouteKey } from "@/domain/work-report";
import { useWorkReportStore } from "@/store/useWorkReportStore";

const items = [
  ["/admin/dashboard", "dashboard", "生产总览", Gauge],
  ["/admin/orders", "orders", "工单与工序", ClipboardList],
  ["/admin/import", "import", "小组长导入", Upload],
  ["/admin/assignments", "assignments", "人员分配", UserPlus],
  ["/admin/reports", "reports", "报工记录", FileClock],
  ["/admin/people", "people", "人员统计", UsersRound],
  ["/admin/permissions", "permissions", "权限设置", ShieldCheck],
  ["/admin/accounts", "accounts", "账号管理", UserCog],
  ["/admin/exceptions", "exceptions", "异常审核", AlertTriangle],
  ["/admin/settings", "settings", "系统设置", Settings],
] as const;

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const visibleItems = items.filter(([, routeKey]) => canAccessAdminRoute(capabilities, routeKey as AdminRouteKey));
  return (
    <div className="admin-shell">
      <aside className={open ? "open" : ""}>
        <header>
          <div className="brand-mark">
            <Wrench />
          </div>
          <div>
            <strong>薪发科技</strong>
            <span>报工管理后台</span>
          </div>
          <button onClick={() => setOpen(false)}>
            <X />
          </button>
        </header>
        <nav>
          {visibleItems.map(([to, , label, Icon]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <footer>
          <span className="admin-avatar">管</span>
          <div>
            <strong>生产管理员</strong>
            <small>管理员</small>
          </div>
        </footer>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar">
          <button className="menu-button" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div>
            <BarChart3 />
            <span>实时生产数据</span>
          </div>
          <a href="/work/claim">打开移动端</a>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
      {open && <div className="admin-overlay" onClick={() => setOpen(false)} />}
    </div>
  );
}
