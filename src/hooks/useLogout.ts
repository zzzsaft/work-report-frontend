import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

export function useLogout() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  return useCallback(() => {
    logout();
    navigate("/", { replace: true });
  }, [logout, navigate]);
}
