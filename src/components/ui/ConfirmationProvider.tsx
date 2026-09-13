import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@jc-times/business-ui";

type Confirm = (description: string, options?: { title?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
type Request = { description: string; title?: string; confirmLabel?: string; danger?: boolean; resolve: (confirmed: boolean) => void };
const ConfirmationContext = createContext<Confirm | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Request | null>(null);
  const confirm = useCallback<Confirm>((description, options) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { description, ...options, resolve };
      pending.current = next;
      setRequest(next);
    });
  }, []);
  const finish = (confirmed: boolean) => {
    pending.current?.resolve(confirmed);
    pending.current = null;
    setRequest(null);
  };
  useEffect(() => () => { pending.current?.resolve(false); pending.current = null; }, []);
  return <ConfirmationContext.Provider value={confirm}>
    {children}
    {request && <ConfirmDialog open title={request.title ?? "请确认"} description={request.description}
      confirmLabel={request.confirmLabel ?? "确认"} confirmVariant={request.danger ? "danger" : "primary"}
      onConfirm={() => finish(true)} onCancel={() => finish(false)} />}
  </ConfirmationContext.Provider>;
}

// This module intentionally exports the hook alongside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("ConfirmationProvider is required");
  return confirm;
}
