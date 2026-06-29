import { useMemo, useState, type FormEvent } from "react";
import { Building2, LogIn } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { getErrorMessage } from "@/utils/errors";
import { isWeComBrowser } from "@/utils/wecom";
import styles from "./LoginPage.module.less";
import { WeComLoginPanel } from "./WeComLoginPanel";

export function LoginPage({ redirect }: { redirect: string }) {
  const autoWeComLogin = useMemo(() => isWeComBrowser(), []);
  const [loginMode, setLoginMode] = useState<"password" | "wecom">(
    autoWeComLogin ? "wecom" : "password",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const isLoading = useAuthStore((state) => state.isLoading);
  const loginWithPassword = useAuthStore((state) => state.loginWithPassword);

  if (loginMode === "wecom") {
    return (
      <WeComLoginPanel
        redirect={redirect}
        onBack={autoWeComLogin ? undefined : () => setLoginMode("password")}
      />
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("请输入账号和密码");
      return;
    }

    setError("");
    try {
      await loginWithPassword(trimmedUsername, password);
    } catch (loginError) {
      setError(getErrorMessage(loginError, "账号或密码错误，请重新输入"));
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="password-login-title">
        <h1 id="password-login-title">账号密码登录</h1>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <label>
            <span>账号</span>
            <input
              autoComplete="username"
              autoFocus
              name="username"
              placeholder="请输入账号"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            <span>密码</span>
            <input
              autoComplete="current-password"
              name="password"
              placeholder="请输入密码"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.primaryButton} disabled={isLoading} type="submit">
            {isLoading ? <span className="spinner small" /> : <LogIn />}
            登录
          </button>
        </form>
        <button
          className={styles.secondaryButton}
          disabled={isLoading}
          type="button"
          onClick={() => setLoginMode("wecom")}
        >
          <Building2 />
          企业微信登录
        </button>
      </section>
    </main>
  );
}
