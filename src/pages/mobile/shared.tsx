import { Alert, Badge, Button, ModalShell, PageHeader as PublicPageHeader, RecoverableAsyncState } from "@jc-times/business-ui";
import { useId, useState, type ReactNode } from "react";
import { statusLabel, type OperationAssignment } from "@/domain/work-report";
import { cx } from "./mobileUtils";
import styles from "./mobileShared.module.less";

export function LoadingState() { return <div className={styles["page-state"]}><RecoverableAsyncState phase="loading" errorTitle="加载失败" loadingTitle="正在加载报工数据..." /></div>; }
export function ErrorBanner({ message, retry }: { message: string; retry?: () => void }) { return <Alert tone="danger" className={styles["error-banner"]} description={message} action={retry && <Button variant="ghost" onClick={retry}>重试</Button>} />; }

export function StatusPill({ status }: { status: OperationAssignment["status"] }) {
  const tone = status === "paused" ? "warning" : status === "assigned" ? "info" : status === "exception" || status === "cancelled" ? "danger" : "success";
  return <Badge tone={tone} className={cx(styles["status-pill"], styles[`status-${status}`])}><span />{statusLabel[status]}</Badge>;
}

export function AvatarCircle({ src, name, className }: { src?: string | null; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  const avatarText = Array.from(name)[0] || "用";
  if (src && !failed) {
    return <img className={className} src={src} alt={name} onError={() => setFailed(true)} />;
  }
  return <div className={className}>{avatarText}</div>;
}

export function BottomSheet({ title, children, onClose, footer, busy = false }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; busy?: boolean }) {
  const titleId = useId();
  return <ModalShell titleId={titleId} title={title} closeLabel="关闭" onClose={onClose}
    closeDisabled={busy} panelClassName="work-report-sheet" backdropClassName="work-report-sheet-backdrop" footer={footer}>{children}</ModalShell>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <PublicPageHeader className={styles["page-header"]} title={title} description={subtitle} />;
}
