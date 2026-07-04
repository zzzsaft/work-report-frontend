import { CalendarClock, CheckCircle2, Factory, LogOut, UsersRound, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import { openXft } from "@/utils/xft";
import { AvatarCircle, PageHeader } from "./shared";
import { requireAuth } from "./mobileUtils";
import sharedStyles from "./mobileShared.module.less";
import pageStyles from "./ProfilePage.module.less";

const styles = { ...pageStyles, ...sharedStyles };

export function ProfilePage() {
  const logout = useLogout();
  const navigate = useNavigate();
  const { name, userId, avatar, token } = useAuthStore();
  const capabilities = useWorkReportStore((state) => state.capabilities);
  const canViewAdmin = capabilities?.canViewAdmin ?? false;
  const displayName = name?.trim() || (requireAuth ? "未提供姓名" : "张师傅");
  const displayUserId = userId?.trim() || (requireAuth ? "未提供工号" : "EMP-20240018");
  return <div className={styles["standard-page"]}><PageHeader title="我的" subtitle={requireAuth ? "企业微信登录信息" : "个人信息与演示设置"} /><section className={styles["profile-card"]}><AvatarCircle className={styles["profile-avatar"]} src={avatar} name={displayName} /><div><h2>{displayName}</h2><p>{requireAuth ? "企业微信已验证" : "生产一组 · 白班"}</p></div></section><section className={styles["profile-menu"]}><button><UsersRound /><span><strong>工号</strong><small>{displayUserId}</small></span></button>{requireAuth ? <button><CheckCircle2 /><span><strong>登录状态</strong><small>已验证</small></span></button> : <button><CalendarClock /><span><strong>当前班次</strong><small>08:00 - 20:00</small></span></button>}{canViewAdmin && <button onClick={() => navigate("/admin/dashboard")}><Factory /><span><strong>进入管理后台</strong><small>查看生产数据</small></span></button>}<button onClick={() => openXft("", token)}><WalletCards /><span><strong>进入薪福通</strong><small>打开薪福通工作台</small></span></button></section><button className={styles["logout-action"]} onClick={logout}><LogOut />退出登录</button></div>;
}
