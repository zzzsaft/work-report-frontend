const authApiBaseURL = import.meta.env.VITE_AUTH_API_BASE_URL;

if (!authApiBaseURL) {
  throw new Error("缺少 VITE_AUTH_API_BASE_URL 配置");
}

const allowedXftParams = new Set(["pageId", "todoid"]);

export const createXftSsoUrl = (search = "", token?: string | null) => {
  const params = new URLSearchParams(search);
  const ssoParams = new URLSearchParams();

  allowedXftParams.forEach((key) => {
    const value = params.get(key);
    if (value) ssoParams.set(key, value);
  });
  if (token) ssoParams.set("token", token);

  const query = ssoParams.toString();
  return `${authApiBaseURL.replace(/\/+$/, "")}/xft/sso${query ? `?${query}` : ""}`;
};

export const openXft = (search = "", token?: string | null) => {
  window.location.href = createXftSsoUrl(search, token);
};
