import { useEffect, useRef, useState } from "react";
import {
  createLoginState,
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
    if (!panelElement.current) return;

    const state = createLoginState(redirect);
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
  }, [redirect]);

  return (
    <main className="wecom-login-page">
      <section className="wecom-login-card">
        <h1>企业微信登录</h1>
        <p>{isAutoLogin ? "正在打开企业微信登录..." : "请在下方登录面板中完成身份验证"}</p>
        <div className="wecom-panel" ref={panelElement} />
        {error && <div className="wecom-panel-error">{error}</div>}
        {onBack && (
          <button className="login-secondary-button" type="button" onClick={onBack}>
            返回账号密码登录
          </button>
        )}
      </section>
    </main>
  );
}
