import { useEffect, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { canAccessAdminRoute, type AdminRouteKey } from "@/domain/work-report";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { LoadingScreen } from "./LoadingScreen";
import styles from "./CapabilityGuard.module.less";

const adminRouteOrder: AdminRouteKey[] = ["dashboard", "orders", "import", "assignments", "reports", "people", "permissions", "accounts", "wecom", "exceptions", "settings"];

function getAdminHome(capabilities: ReturnType<typeof useWorkReportStore.getState>["capabilities"]) {
  return adminRouteOrder.find((routeKey) => canAccessAdminRoute(capabilities, routeKey));
}

function NoAdminPermission({ message }: { message: string }) {
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const adminHome = getAdminHome(capabilities);
  return (
    <div className={styles.emptyState}>
      <h1>无权访问管理后台</h1>
      <p>{message}</p>
      <div className={styles.emptyActions}>
        {adminHome && <Link className={styles.primaryButton} to={`/admin/${adminHome}`}>返回可访问后台首页</Link>}
        <Link className={styles.ghostButton} to="/work/claim">打开移动端</Link>
      </div>
    </div>
  );
}

export function CapabilityGuard({ children }: { children: ReactNode }) {
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const loading = useWorkReportStore((state) => state.capabilitiesLoading);
  const error = useWorkReportStore((state) => state.error);
  const loadCapabilities = useWorkReportStore((state) => state.loadCapabilities);

  useEffect(() => {
    void loadCapabilities({ force: true });
  }, [loadCapabilities]);

  if (loading || (!capabilities && !error)) {
    return <LoadingScreen text="正在验证管理权限..." />;
  }

  if (!capabilities?.canViewAdmin) {
    if (error) {
      return (
        <div className={styles.emptyState}>
          <h1>无权访问管理后台</h1>
          <p>{error}</p>
          <button className={styles.primaryButton} onClick={() => void loadCapabilities({ force: true })}>重试</button>
        </div>
      );
    }
    return <NoAdminPermission message="当前账号没有管理后台访问权限。" />;
  }

  return children;
}

export function AdminIndexRedirect() {
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const adminHome = getAdminHome(capabilities);
  return <Navigate to={adminHome || "/work/claim"} replace />;
}

export function AdminRouteGuard({ routeKey, children }: { routeKey: AdminRouteKey; children: ReactNode }) {
  const capabilities = useWorkReportStore((state) => state.capabilities);
  if (!canAccessAdminRoute(capabilities, routeKey)) {
    return <NoAdminPermission message="当前账号没有该后台页面权限。" />;
  }
  return children;
}
