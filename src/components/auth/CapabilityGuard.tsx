import { useEffect, type ReactNode } from "react";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { LoadingScreen } from "./LoadingScreen";

export function CapabilityGuard({ children }: { children: ReactNode }) {
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const loading = useWorkReportStore((state) => state.capabilitiesLoading);
  const error = useWorkReportStore((state) => state.error);
  const loadCapabilities = useWorkReportStore((state) => state.loadCapabilities);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  if (loading || (!capabilities && !error)) {
    return <LoadingScreen text="正在验证管理权限..." />;
  }

  if (!capabilities?.canViewAdmin) {
    return (
      <div className="empty-state">
        <h1>无权访问管理后台</h1>
        <p>{error || "当前账号没有管理后台访问权限。"}</p>
        {error && <button className="primary-button" onClick={() => void loadCapabilities()}>重试</button>}
      </div>
    );
  }

  return children;
}
