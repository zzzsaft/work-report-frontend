# 报工前端公共 UI 接入

## 依赖与主题

应用固定消费 npmjs 公共包 `@jc-times/business-ui@0.2.43`，React 19 保持不变，Lucide 固定为公共库 peer 范围内的 `0.468.0`。项目 `.npmrc` 只把 `@jc-times` 指向 npm 官方源，并禁止 npm 将锁文件地址替换为本机镜像；不含任何凭据。其他电脑可直接通过 `npm ci` 安装，无需包读取 Token。

`src/main.tsx` 首先加载公共样式，随后加载应用样式。`src/styles/business-ui.css` 将公共语义令牌映射到现有蓝色主题、文字、画布和成功/警告/危险色。页面布局和移动端大触控尺寸继续由应用决定。

## 迁移范围

| 场景 | 公共组件与应用适配 |
| --- | --- |
| 按钮、表单、勾选、开关 | Button、TextInput、TextArea、SelectInput、Checkbox、ToggleSwitch |
| 日期、数字 | DateInput、NumericInput；原始时间字符串和部门数字契约保持不变 |
| 页面标题、指标、状态与反馈 | PageHeader、MetricCard、Badge、Alert、EmptyState、RecoverableAsyncState |
| 人员工序多选 | MultiSelect，查询与业务筛选仍在 useStaffStats |
| 页签、期间与状态筛选 | RovingTabList/RovingTabPanel、SegmentedControl |
| 分页 | Pagination；报工记录继续由服务端筛选和分页，客户端不二次分页 |
| 10处普通列表 | ReportTable 包装公共 DataTable，保留原列内容、行标识、操作与班组行选择 |
| 班组编辑、成员添加 | ReportDialog 包装 ModalShell，操作放 footer，保存期间禁用关闭 |
| 移动端底部弹窗 | BottomSheet 包装 ModalShell，保留底部圆角样式及安全区，复用焦点/滚动管理 |
| 删除与重复领取确认 | ConfirmationProvider 包装 ConfirmDialog，异步布尔结果接续原业务操作 |
| 完工照片入口 | FileDropzone；原图片校验、预览、编码和提交流程仍由报工页面负责 |

保留的领域实现：导航路由、工单/产品/部件业务卡片、权限规则、查询与无限加载、Recharts 统计图、薪福通和小组长导入的 Handsontable 批量粘贴编辑器。它们不是公共基础 UI 的复制实现，周边操作已使用公共控件。原生时间输入通过公共 TextInput 保留浏览器时间选择体验。

旧 CSS 中部分规则保留用于领域布局和兼容既有页面；不通过复制公共组件内部实现来匹配外观。后续公共能力缺陷应在公共仓库修复后发布新版本再消费。

## 验证与运行边界

- `npm run build`：类型检查和生产构建。
- `npm run lint`：代码静态检查。
- `npm run check:ui`：公共库提供的 UI 门禁，初始审核基线为 `{}`，不允许新增原生表单或手写模态。
- `npm run test:ui`：桌面/手机浏览器，独立 `127.0.0.1:5186`；使用模拟业务数据，拦截所有外部请求。覆盖页面主题与溢出、公共表格筛选编辑、模态焦点/保存/删除确认、移动筛选、日期和重复领取。
- `npm test`：既有领域测试；已发现权限测试期待小组长不能进入 assignments，但当前领域实现明确对所有登录用户开放，本轮未修改这项权限规则或测试。

表格使用独立入口和页面懒加载；Vite 的 React 分包规则按精确依赖路径匹配，避免把 MRT/MUI 和所有名称带 react 的组件都提前装入 React 包。

本轮是本地消费迁移，不涉及公共库发布、后端变更或生产部署。部署仍走本项目的 `npm run deploy`，需按部署任务核验真实认证和后端环境。

## 2026-09-12 验收结果

- 保留既有主题，完成本地公共基础 UI 消费迁移；未提交、未部署。
- 手机顶部隐藏次要状态文字，保留菜单、薪福通、移动端与退出入口；320/390/412px 下文字完整且触控区至少44px。
- 320/390/412/768/1440px × 8个重点页面检查控件裁切、重叠、触控尺寸和页面溢出；筛选区和导入配置改为自适应列，宽表在表内横向滚动。
- 弹窗正文和底栏留20px横向内边距，操作按钮间距12px；测量在入场动画结束后执行。
- build、lint、check:ui、diff检查通过。浏览器全量12通过、2跳过（只需手机项目运行的宽度审计），最终弹窗留白专项桌面/手机2通过。
- 既有单测32通过、1失败；从HEAD提取领域文件独立复现相同权限断言失败，未更改权限规则来规避该失败。
- 模拟数据下完成验证，真实认证与后端联调不属于本次验收；截图留在本地忽略目录 `.dist/ui-qa/`。

## 2026-09-12 升级至0.2.32
- 已从正式registry精确安装0.2.32并更新锁文件；Lucide 0.468.0仍在新版peer范围内，应用React与主题不变。
- build、lint、check:ui通过；桌面/手机浏览器12通过、2按项目跳过，包含5宽度×8页拥挤审计、日期、弹窗和表格交互。
- 单测仍32通过、1项原有权限断言失败，无新增失败；未提交、未部署。

## 2026-09-14 切换至 npmjs

- npmjs 已公开发布 `@jc-times/business-ui@0.2.43`；项目升级到该精确版本并更新锁文件。
- 移除 GitHub Packages 源，锁文件制品地址改为 `registry.npmjs.org`，安装不再需要 GitHub Packages Token。项目保留无凭据 `.npmrc`，避免使用 npmmirror 的电脑把新发布包重写到尚未同步的镜像地址。
