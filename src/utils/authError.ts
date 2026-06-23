import axios from "axios";

export interface AuthErrorDetails {
  reason: string;
  endpoint?: string;
  status?: string;
  errorCode?: string;
  authCode?: string;
}

const getBackendMessage = (data: unknown): string | undefined => {
  if (typeof data === "string" && data.trim()) return data;
  if (!data || typeof data !== "object") return undefined;

  const body = data as Record<string, unknown>;
  for (const key of ["message", "msg", "detail", "error_description", "error"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return undefined;
};

export const describeAuthError = (error: unknown, authCode?: string): AuthErrorDetails => {
  if (!axios.isAxiosError(error)) {
    return {
      reason: error instanceof Error ? error.message : "发生未知错误",
    };
  }

  const endpoint = error.config?.url;
  const errorCode = error.code;

  if (errorCode === "ECONNABORTED") {
    return {
      reason: "认证后端响应超时，请检查网络后重试",
      endpoint,
      errorCode,
    };
  }

  if (!error.response) {
    return {
      reason: "无法连接认证后端，请检查网络、后端服务或跨域配置",
      endpoint,
      errorCode: errorCode || "NETWORK_ERROR",
    };
  }

  const reason = getBackendMessage(error.response.data) || "认证后端拒绝了本次请求";

  return {
    reason,
    endpoint,
    status: `${error.response.status} ${error.response.statusText}`.trim(),
    errorCode,
    ...(authCode && /invalid[\s_-]*code/i.test(reason) ? { authCode } : {}),
  };
};
