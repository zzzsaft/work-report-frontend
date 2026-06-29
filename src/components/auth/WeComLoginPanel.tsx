import { useEffect, useRef, useState } from "react";
import styles from "./AuthShared.module.less";
import {
  createLoginState,
  createWeComOAuthUrl,
  isWeComBrowser,
  mountWeComLoginPanel,
} from "@/utils/wecom";

export function WeComLoginPanel({
  redirect,
  onBack,
}: {
  redirect: string;
  onBack?: () => void;
}) {
  const panelElement = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const isAutoLogin = isWeComBrowser();

  useEffect(() => {
    const state = createLoginState(redirect);

    if (isAutoLogin) {
      try {
        window.location.replace(
          createWeComOAuthUrl({
            state,
            redirectUri: `${window.location.origin}/auth-callback`,
          })
        );
      } catch (redirectError) {
        setError(
          redirectError instanceof Error
            ? redirectError.message
            : "企业微信登录跳转失败"
        );
      }

      return;
    }

    if (!panelElement.current) return;

    let panel: ReturnType<typeof mountWeComLoginPanel> | undefined;

    try {
      panel = mountWeComLoginPanel({
        element: panelElement.current,
        state,
        redirectUri: window.location.href,
        onSuccess: (code) => {
          const params = new URLSearchParams({ code, state });
          window.location.assign(`/auth-callback?${params.toString()}`);
        },
        onFail: ({ errCode, errMsg }) => {
          const codeText =
            errCode === undefined ? "" : `（错误码：${errCode}）`;
          setError(`${errMsg || "企业微信登录面板授权失败"}${codeText}`);
        },
      });
    } catch (mountError) {
      setError(
        mountError instanceof Error
          ? mountError.message
          : "企业微信登录面板加载失败"
      );
    }

    return () => panel?.unmount();
  }, [isAutoLogin, redirect]);

  return (
    <main className={styles["wecom-login-page"]}>
      <section className={styles["wecom-login-card"]}>
        <h1>企业微信登录</h1>
        <p>{isAutoLogin ? "正在打开企业微信登录..." : "请在下方登录面板中完成身份验证"}</p>
        {!isAutoLogin && <div className={styles["wecom-panel"]} ref={panelElement} />}
        {error && <div className={styles["wecom-panel-error"]}>{error}</div>}
        {onBack && (
          <button className={styles["login-secondary-button"]} type="button" onClick={onBack}>
            返回账号密码登录
          </button>
        )}
      </section>
    </main>
  );
}
