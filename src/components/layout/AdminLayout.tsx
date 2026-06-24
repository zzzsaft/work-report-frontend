import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  FileClock,
  Gauge,
  Menu,
  Settings,
  Upload,
  UserPlus,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const items = [
  ["/admin/dashboard", "生产总览", Gauge],
  ["/admin/orders", "工单与工序", ClipboardList],
  ["/admin/import", "小组长导入", Upload],
  ["/admin/assignments", "人员分配", UserPlus],
  ["/admin/reports", "报工记录", FileClock],
  ["/admin/people", "人员统计", UsersRound],
  ["/admin/exceptions", "异常审核", AlertTriangle],
  ["/admin/settings", "系统设置", Settings],
] as const;

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
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
          {items.map(([to, label, Icon]) => (
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
