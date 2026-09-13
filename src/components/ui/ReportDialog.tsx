import { useId, type ReactNode } from "react";
import { ModalShell } from "@jc-times/business-ui";

export function ReportDialog({ title, children, footer, onClose, busy = false }: {
  title: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const titleId = useId();
  return <ModalShell titleId={titleId} title={title} closeLabel="关闭" onClose={onClose}
    closeDisabled={busy} contentClassName="work-report-dialog-content" footer={footer} footerClassName="work-report-dialog-actions">{children}</ModalShell>;
}
