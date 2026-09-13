import { Alert, Badge, Button, Checkbox, TextInput } from "@jc-times/business-ui";
import { ReportTable } from "@/components/ui/ReportTable";
import { useCallback, useState } from "react";
import { KeyRound, Power, Search, UserCog, UserPlus } from "lucide-react";
import { AuthService, type AccountRole, type AdminAccount } from "@/api/services/auth.service";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { getErrorMessage } from "@/utils/errors";
import { AdminError, AdminHeader, LoadingTable, SearchBox } from "./adminShared";
import { cx, permissionOptions } from "./adminUtils";
import styles from "./AdminPages.module.less";

const accountRoleOptions: Array<{ value: AccountRole; label: string }> = permissionOptions.map((option) => ({
  value: option.value,
  label: option.label,
}));
const emptyAccountForm = { username: "", name: "", password: "", enabled: true, roles: ["worker"] as AccountRole[] };

function normalizeAccountRoles(roles: AccountRole[], role: AccountRole) {
  return roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
}

export default function AccountsPage() {
  const [keyword, setKeyword] = useState("");
  const [form, setForm] = useState(emptyAccountForm);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [resetPasswordById, setResetPasswordById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const load = useCallback(() => AuthService.getAdminAccounts(keyword.trim()), [keyword]);
  const { data: accounts = [], loading, error, reload } = useAsyncResource<AdminAccount[]>(load);
  const createAccount = async () => {
    const username = form.username.trim();
    const name = form.name.trim();
    if (!username || !name || !form.password || form.roles.length === 0) {
      setMessage("请填写账号、姓名、初始密码并至少选择一个权限组");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await AuthService.createAdminAccount({ username, name, password: form.password, roles: form.roles, enabled: form.enabled });
      setForm(emptyAccountForm);
      setMessage(`已创建账号 ${username}`);
      await reload();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const updateAccount = async (account: AdminAccount, input: { roles?: AccountRole[]; enabled?: boolean }) => {
    setSavingId(account.id);
    setMessage("");
    try {
      await AuthService.updateAdminAccount(account.id, input);
      setMessage(`已更新账号 ${account.username}`);
      await reload();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingId("");
    }
  };
  const resetPassword = async (account: AdminAccount) => {
    const password = resetPasswordById[account.id] || "";
    if (!password) {
      setMessage("请输入新密码");
      return;
    }
    setSavingId(account.id);
    setMessage("");
    try {
      await AuthService.resetAdminAccountPassword(account.id, password);
      setResetPasswordById((current) => ({ ...current, [account.id]: "" }));
      setMessage(`已重置 ${account.username} 的密码`);
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingId("");
    }
  };
  return <><AdminHeader title="账号管理" description="管理员创建网页登录账号，外部不开放注册" action={<div className={cx(styles["admin-inline-actions"])}><SearchBox value={keyword} onChange={setKeyword} placeholder="搜索账号或姓名" /><Button variant="primary" className={cx(styles["admin-primary-action"])} onClick={() => void reload()}><Search />搜索</Button></div>} />{message && <Alert className={cx(styles["admin-message"])} tone={"info"} description={<>{message}</>} />}<div className={cx(styles["account-admin-grid"])}><section className={cx(styles["admin-panel"], styles["settings-card"])}><div className={cx(styles["settings-icon"])}><UserCog /></div><h2>创建账号</h2><label className={cx(styles["admin-field"])}>账号<TextInput value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="例如 zhangsan" /></label><label className={cx(styles["admin-field"])}>姓名<TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="员工姓名" /></label><label className={cx(styles["admin-field"])}>初始密码<TextInput type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="由管理员设置" /></label><div className={cx(styles["admin-field"])}><span>权限组</span><div className={cx(styles["permission-select-cell"])}>{accountRoleOptions.map((option) => <Button variant="ghost" key={option.value} className={form.roles.includes(option.value) ? styles.selected : undefined} type="button" onClick={() => setForm((current) => ({ ...current, roles: normalizeAccountRoles(current.roles, option.value) }))}>{option.label}</Button>)}</div></div><div className={cx(styles["admin-toggle-row"])}><Checkbox label={<>启用账号</>} checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} /></div><Button variant="primary" className={cx(styles["admin-primary-action"], styles["full-width"])} disabled={saving} onClick={() => void createAccount()}><UserPlus />创建账号</Button></section><section className={cx(styles["admin-panel"], styles["account-list-panel"])}>{loading ? <LoadingTable /> : error ? <AdminError message={error} retry={() => void reload()} /> : <div className={cx(styles["table-wrap"])}><ReportTable  columns={[{ title: "账号" },
{ title: "姓名" },
{ title: "权限组" },
{ title: "状态" },
{ title: "最近登录" },
{ title: "重置密码" },
{ title: "操作" }]} rows={accounts.map((account) => ({ id: String(account.id), cells: [<><strong>{account.username}</strong></>,
<>{account.name}</>,
<><div className={cx(styles["permission-select-cell"])}>{accountRoleOptions.map((option) => <Button variant="ghost" key={option.value} className={account.roles.includes(option.value) ? styles.selected : undefined} disabled={savingId === account.id} onClick={() => void updateAccount(account, { roles: normalizeAccountRoles(account.roles, option.value) })}>{option.label}</Button>)}</div></>,
<><Badge className={cx(styles["admin-status"], account.enabled ? styles.completed : styles.paused)}>{account.enabled ? "已启用" : "已停用"}</Badge></>,
<>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString("zh-CN") : "未登录"}</>,
<><div className={cx(styles["reset-password-cell"])}><TextInput aria-label="新密码" type="password" value={resetPasswordById[account.id] || ""} onChange={(event) => setResetPasswordById((current) => ({ ...current, [account.id]: event.target.value }))} placeholder="新密码" /><Button variant="ghost" className={cx(styles["table-action"])} disabled={savingId === account.id} onClick={() => void resetPassword(account)}><KeyRound />重置</Button></div></>,
<><Button variant="danger" className={cx(styles["table-action"], account.enabled && styles["danger-action"])} disabled={savingId === account.id} onClick={() => void updateAccount(account, { enabled: !account.enabled })}><Power />{account.enabled ? "停用" : "启用"}</Button></> ] }))} emptyTitle={"没有匹配的账号。"} /></div>}</section></div></>;
}
