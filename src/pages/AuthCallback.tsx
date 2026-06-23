import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoadingScreen } from "@/components/auth/LoadingScreen";
import { useAuthStore } from "@/store/useAuthStore";
import { describeAuthError, type AuthErrorDetails } from "@/utils/authError";
import { parseLoginState } from "@/utils/wecom";

export default function AuthCallback() {
  const handled = useRef(false);
  const [error, setError] = useState<AuthErrorDetails | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginWithCode = useAuthStore((state) => state.loginWithCode);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get("code");
    if (!code) {
      const weComError = searchParams.get("error_description") || searchParams.get("error");
      setError({
        reason: weComError || "企业微信回调地址中缺少认证参数 code",
        errorCode: searchParams.get("error") || "MISSING_CODE",
      });
      return;
    }

    const verify = async () => {
      try {
        await loginWithCode(code);
        navigate(parseLoginState(searchParams.get("state")), { replace: true });
      } catch (verifyError) {
        setError(describeAuthError(verifyError, code));
      }
    };

    void verify();
  }, [loginWithCode, navigate, searchParams]);

  if (error) {
    return (
      <main className="error-screen">
        <section className="login-error-card" aria-labelledby="login-error-title">
          <p className="error-label">身份验证失败</p>
          <h1 id="login-error-title">无法登录</h1>

          <dl className="error-details">
            <div>
              <dt>失败原因</dt>
              <dd>{error.reason}</dd>
            </div>
            {error.endpoint && (
              <div>
                <dt>请求接口</dt>
                <dd>{error.endpoint}</dd>
              </div>
            )}
            {error.status && (
              <div>
                <dt>HTTP 状态</dt>
                <dd>{error.status}</dd>
              </div>
            )}
            {error.errorCode && (
              <div>
                <dt>错误代码</dt>
                <dd>{error.errorCode}</dd>
              </div>
            )}
            {error.authCode && (
              <div>
                <dt>企业微信 Code</dt>
                <dd>{error.authCode}</dd>
              </div>
            )}
          </dl>

          <p className="error-help">重试后仍失败，请将以上信息提供给管理员。</p>
          <a href="/">重新登录</a>
        </section>
      </main>
    );
  }

  return <LoadingScreen text="正在验证登录状态..." />;
}
