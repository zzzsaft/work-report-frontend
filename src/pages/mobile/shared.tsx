import { useState, type ReactNode } from "react";
import { CircleAlert, X } from "lucide-react";
import { statusLabel, type OperationAssignment } from "@/domain/work-report";
import { cx } from "./mobileUtils";
import styles from "./mobileShared.module.less";

export function LoadingState() { return <div className={styles["page-state"]}><span className="spinner" /><p>正在加载报工数据...</p></div>; }
export function ErrorBanner({ message, retry }: { message: string; retry?: () => void }) { return <div className={styles["error-banner"]}><CircleAlert /><span>{message}</span>{retry && <button onClick={retry}>重试</button>}</div>; }

export function StatusPill({ status }: { status: OperationAssignment["status"] }) {
  return <span className={cx(styles["status-pill"], styles[`status-${status}`])}><span />{statusLabel[status]}</span>;
}

export function AvatarCircle({ src, name, className }: { src?: string | null; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  const avatarText = Array.from(name)[0] || "用";
  if (src && !failed) {
    return <img className={className} src={src} alt={name} onError={() => setFailed(true)} />;
  }
  return <div className={className}>{avatarText}</div>;
}

export function BottomSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className={styles["sheet-backdrop"]} role="presentation" onMouseDown={onClose}>
    <section className={styles["bottom-sheet"]} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles["sheet-handle"]} /><header><h2>{title}</h2><button className={styles["icon-button"]} onClick={onClose} aria-label="关闭"><X /></button></header>{children}
    </section>
  </div>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <header className={styles["page-header"]}><h1>{title}</h1><p>{subtitle}</p></header>;
}
