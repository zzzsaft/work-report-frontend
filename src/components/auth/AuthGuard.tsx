import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { LoadingScreen } from "./LoadingScreen";
import { LoginPage } from "./LoginPage";

export function AuthGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const checkedToken = useRef<string | null>(null);
  const requestId = useRef(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const { token, isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      setAuthChecked(true);
      setShowLoginPanel(false);
      return;
    }

    if (!token) {
      requestId.current += 1;
      checkedToken.current = null;
      setAuthChecked(false);
      setShowLoginPanel(true);
      return;
    }

    if (checkedToken.current === token) return;
    checkedToken.current = token;
    const request = ++requestId.current;
    setAuthChecked(false);
    setShowLoginPanel(false);

    const authenticate = async () => {
      if (await checkAuth()) {
        if (request !== requestId.current) return;
        setAuthChecked(true);
        return;
      }

      if (request === requestId.current) setShowLoginPanel(true);
    };

    void authenticate();
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
