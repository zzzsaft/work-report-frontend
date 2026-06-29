import {
  createWWLoginPanel,
  WWLoginPanelSizeType,
  WWLoginRedirectType,
  WWLoginType,
  type WWLoginErrorResp,
  type WWLoginInstance,
} from "@wecom/jssdk";

const corpId = import.meta.env.VITE_WECOM_CORP_ID;
const agentId = import.meta.env.VITE_WECOM_AGENT_ID;

const assertWeComConfig = () => {
  if (!corpId || !agentId) {
    throw new Error("缺少企业微信 CorpId 或 AgentId 配置");
  }
};

export const isWeComBrowser = () => /wxwork/i.test(window.navigator.userAgent);

export const createLoginState = (redirect: string) =>
  JSON.stringify({ redirect });

export const parseLoginState = (state: string | null) => {
  if (!state) return "/";

  try {
    const parsed = JSON.parse(state) as { redirect?: unknown };
    const redirect =
      typeof parsed.redirect === "string" ? parsed.redirect : "/";
    return redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : "/";
  } catch {
    return "/";
  }
};

export const createWeComOAuthUrl = ({
  state,
  redirectUri,
}: {
  state: string;
  redirectUri: string;
}) => {
  assertWeComConfig();

  const params = new URLSearchParams({
    appid: corpId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_privateinfo",
    state,
    agentid: agentId,
  });

  return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
};

interface WeComLoginPanelOptions {
  element: Element;
  state: string;
  redirectUri: string;
  onSuccess: (code: string) => void;
  onFail: (error: WWLoginErrorResp) => void;
}

export const mountWeComLoginPanel = ({
  element,
  state,
  redirectUri,
  onSuccess,
  onFail,
}: WeComLoginPanelOptions): WWLoginInstance => {
  assertWeComConfig();

  return createWWLoginPanel({
    el: element,
    params: {
      login_type: WWLoginType.corpApp,
      appid: corpId,
      agentid: agentId,
      redirect_uri: redirectUri,
      redirect_type: WWLoginRedirectType.callback,
      panel_size: WWLoginPanelSizeType.small,
      state,
    },
    onLoginSuccess: ({ code }) => onSuccess(code),
    onLoginFail: onFail,
  });
};
