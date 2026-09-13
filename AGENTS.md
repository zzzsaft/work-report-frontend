# 项目开发约定

## 项目边界

- 本项目复用 `D:\jdy_backend1\my-react-app` 的登录验证架构。
- 当前包含企业微信/账号登录、手机报工和生产管理；登录与报工域职责分离。
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
- UI 修改同时运行 `npm run check:ui` 和 `npm run test:ui`。后者使用独立端口和隔离模拟数据，不连接生产服务。

## 公共 UI

- 使用已发布的精确版本 `@jc-times/business-ui`，提交 `package-lock.json`；不跨仓引用源码或软链接。
- 全局样式入口为 `src/styles/index.css`，现有品牌主题通过 `src/styles/business-ui.css` 映射 `--ui-*`；不要改为公共库默认品牌色。
- 通用表单、按钮、标签、分页、日期、弹窗和确认使用公共组件；业务包装位于 `src/components/ui/`。
- 模态固定操作使用公共 `footer` 插槽；不重写焦点陷阱或调用浏览器 `confirm`。
- 专用 Handsontable 仅保留批量粘贴编辑场景，普通列表统一使用公共 DataTable。
- 私有包凭据由开发环境提供，不写入项目或记忆；接入说明见 `docs/PUBLIC_UI_MIGRATION.md`。
