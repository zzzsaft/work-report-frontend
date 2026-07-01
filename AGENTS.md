# 项目开发约定

## 项目边界

- 本项目复用 `D:\jdy_backend1\my-react-app` 的登录验证架构。
- 当前只包含企业微信登录、验证码换取令牌、令牌校验和登录状态持久化。
- 不从参考项目复制报价、客户、模板、定位、简道云或企业微信 JS-SDK 等业务代码。

## 企业微信登录参数

- 企业 ID：`ww8a8396c98dc4923d`
- AgentId：`1000002`
- 参数统一由 `.env` 中的 `VITE_WECOM_CORP_ID` 和 `VITE_WECOM_AGENT_ID` 提供，不在源码中重复硬编码。
- 无论是否处于企业微信客户端内，登录都统一使用 `@wecom/jssdk` 的 `createWWLoginPanel`，不按 User-Agent 切换 OAuth URL。

## 后端职责

- 所有后端请求统一使用 `.env` 中的 `VITE_API_BASE_URL`。
- 登录接口为 `POST /auth/wecom/token`，请求体固定携带 `clientId: "new-frontend"` 和企业微信返回的 `code`；用户校验接口为 `GET /auth/me`。
- 不新增按业务域分流的后端地址环境变量。

## 代码结构

- HTTP 客户端与拦截器放在 `src/api/http/`。
- API 请求放在 `src/api/services/`。
- 登录状态放在 `src/store/`。
- 登录守卫放在 `src/components/auth/`。
- 企业微信 URL 生成逻辑放在 `src/utils/`。
- 页面只组合状态与展示，不直接拼接后端请求。

## 验证

- 修改后运行 `npm run build` 和 `npm run lint`。
