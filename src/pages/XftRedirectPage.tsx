import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/auth/LoadingScreen";
import { useAuthStore } from "@/store/useAuthStore";
import { openXft } from "@/utils/xft";

export default function XftRedirectPage() {
  const { search } = useLocation();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    document.title = "跳转薪福通";
    openXft(search, token);
  }, [search, token]);

  return <LoadingScreen text="正在进入薪福通..." />;
}
