# Mock Demo 使用说明

## 启用

在 `.env` 设置：

```env
VITE_USE_MOCK_DATA=true
VITE_API_BASE_URL=http://localhost:8080/
```

Mock 模式不发业务 HTTP 请求，也不触发企业微信登录，便于本地演示。数据保存在浏览器 `localStorage` 的 `work-report-mock-db-v2` 中，刷新页面仍保留操作结果。

## 演示角色与场景

- 用户：张师傅，具有 worker、leader、admin 权限，可进入移动端和后台。
- 默认场景：工序正在进行，可暂停、恢复并拍照完工。
- 后台 `/admin/settings` 可重置为“待开始”“进行中”“已暂停”。重置后刷新移动端即可看到对应状态。
- 工序清单的“领取”分段提供可搜索工序池。默认可搜索 `CP-JSJ-240623-07`，再按部件编号选择工序领取。
- 自主领取的未开始工序会显示“删除领取”；开始后按钮消失，需要到高级后台 `/admin/assignments` 移除。
- 小组长后台 `/admin/import` 内置两行 Excel 粘贴示例，可校验并导入到工序池。
- 高级后台 `/admin/assignments` 可搜索工序池、选择产品/部件/工序并分配给演示员工，也可强制移除当前 assignment。
- Mock 内置已完成工序、未来工序、多个工单、人员工时和两类待处理异常。

## 切换真实接口

把 `VITE_USE_MOCK_DATA=false`，填写真实业务地址，并按 `API_INTEGRATION.md` 对齐 repository。页面、store 和认证配置均不需要修改。
