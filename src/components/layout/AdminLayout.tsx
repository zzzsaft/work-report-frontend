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
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { createXftSsoUrl } from "@/utils/xft";
import styles from "./AdminLayout.module.less";


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

function AdminAvatar({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const avatarText = Array.from(name)[0] || "管";
  if (src && !failed) {
    return <img className={styles["admin-avatar"]} src={src} alt={name} onError={() => setFailed(true)} />;
  }
  return <span className={styles["admin-avatar"]}>{avatarText}</span>;
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const { name, avatar, token } = useAuthStore();
  const visibleItems = items.filter(([, routeKey]) => canAccessAdminRoute(capabilities, routeKey as AdminRouteKey));
  const displayName = name?.trim() || "生产管理员";
  return (
    <div className={styles["admin-shell"]}>
      <aside className={open ? styles.open : undefined}>
        <header>
          <div className={styles["brand-mark"]}>
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
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? styles.active : undefined} onClick={() => setOpen(false)}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <footer>
          <AdminAvatar src={avatar} name={displayName} />
          <div>
            <strong>{displayName}</strong>
            <small>管理员</small>
          </div>
        </footer>
      </aside>
      <div className={styles["admin-content"]}>
        <header className={styles["admin-topbar"]}>
          <button className={styles["menu-button"]} onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div>
            <BarChart3 />
            <span>实时生产数据</span>
          </div>
          <div className={styles["topbar-actions"]}>
            <a href={createXftSsoUrl("", token)}>进入薪福通</a>
            <a href="/work/claim">打开移动端</a>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
      {open && <div className={styles["admin-overlay"]} onClick={() => setOpen(false)} />}
    </div>
  );
}
