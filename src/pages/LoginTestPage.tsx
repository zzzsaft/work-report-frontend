import { useAuthStore } from "@/store/useAuthStore";
import { useLogout } from "@/hooks/useLogout";

export default function LoginTestPage() {
  const name = useAuthStore((state) => state.name);
  const userId = useAuthStore((state) => state.userId);
  const logout = useLogout();

  return (
    <main className="login-test-page">
      <section className="login-success-card" aria-labelledby="login-result-title">
        <div className="success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="m7.2 12.1 3.1 3.1 6.7-7" />
          </svg>
        </div>

        <p className="status-label">身份验证结果</p>
        <h1 id="login-result-title">登录成功</h1>
        <p className="success-description">企业微信身份验证已通过</p>

        <dl className="user-details">
          <div>
            <dt>用户姓名</dt>
            <dd>{name || "未提供"}</dd>
          </div>
          <div>
            <dt>UserID</dt>
            <dd className="user-id">{userId || "未提供"}</dd>
          </div>
        </dl>

        <p className="test-hint">这是登录验证测试页面</p>
        <button className="logout-button" type="button" onClick={logout}>
          退出并重新测试
        </button>
      </section>
    </main>
  );
}
