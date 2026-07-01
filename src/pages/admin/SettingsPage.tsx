import { useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, Wrench } from "lucide-react";
import { isMockMode, workReportRepository } from "@/api/services/workReport.service";
import { getErrorMessage } from "@/utils/errors";
import { AdminHeader } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

export default function SettingsPage() {
  const [resetting, setResetting] = useState(false); const [message, setMessage] = useState("");
  const reset = async (scenario: "assigned" | "running" | "paused") => { setResetting(true); setMessage(""); try { await workReportRepository.resetDemo?.(scenario); setMessage("演示数据已重置，移动端刷新后生效"); } catch (error) { setMessage(getErrorMessage(error)); } finally { setResetting(false); } };
  return <><AdminHeader title="系统设置" description="接口环境、统计口径与演示数据" /><div className={cx(styles["settings-grid"])}><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><Wrench /></div><h2>业务 API</h2><dl><div><dt>当前模式</dt><dd><span className={isMockMode ? styles["mode-mock"] : styles["mode-real"]}>{isMockMode ? "Mock 演示" : "真实接口"}</span></dd></div><div><dt>业务服务地址</dt><dd>{import.meta.env.VITE_API_BASE_URL || "未配置"}</dd></div><div><dt>认证服务</dt><dd>统一使用 VITE_API_BASE_URL</dd></div></dl></section><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"], styles["orange"])}><RefreshCw /></div><h2>重置演示场景</h2><p>快速切换当前工序状态，用于演示完整报工流程。</p><div className={cx(styles["scenario-buttons"])}><button disabled={resetting} onClick={() => void reset("assigned")}>待开始</button><button disabled={resetting} onClick={() => void reset("running")}>进行中</button><button disabled={resetting} onClick={() => void reset("paused")}>已暂停</button></div>{message && <div className={cx(styles["success-message"])}><CheckCircle2 />{message}</div>}</section><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><Clock3 /></div><h2>统计口径</h2><p>v1：领取或分配后即计入计划工时。</p><p>后续完整报工版本再按实际开始、暂停、完工记录计算有效工时。</p></section></div></>;
}
