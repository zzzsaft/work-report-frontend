import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { LoadingScreen } from "./LoadingScreen";
import { LoginPage } from "./LoginPage";

export function AuthGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const checkedToken = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const requestId = useRef(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const { token, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    mountedRef.current = true;

    if (isAuthenticated) {
      setAuthChecked(true);
      setShowLoginPanel(false);
      return () => {
        mountedRef.current = false;
      };
    }

    if (!token) {
      requestId.current += 1;
      checkedToken.current = null;
      setAuthChecked(false);
      setShowLoginPanel(true);
      return () => {
        mountedRef.current = false;
      };
    }

    if (checkedToken.current === token) {
      return () => {
        mountedRef.current = false;
      };
    }
    checkedToken.current = token;
    const request = ++requestId.current;
    setAuthChecked(false);
    setShowLoginPanel(false);

    const authenticate = async () => {
      if (await checkAuth()) {
        if (!mountedRef.current || request !== requestId.current) return;
        setAuthChecked(true);
        return;
      }

      if (mountedRef.current && request === requestId.current) setShowLoginPanel(true);
    };

    void authenticate();

    return () => {
      mountedRef.current = false;
    };
  }, [checkAuth, isAuthenticated, location.hash, location.pathname, location.search, token]);

  if (showLoginPanel) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <LoginPage redirect={redirect} />;
  }

  if (isLoading || !authChecked) {
    return <LoadingScreen text="验证登录状态..." />;
  }

  return children;
}
