import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Copy, ExternalLink, QrCode, RefreshCw } from "lucide-react";
import { AuthService, type WeComDepartment, type WeComUser } from "@/api/services/auth.service";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { getErrorMessage } from "@/utils/errors";
import { AdminHeader, LoadingTable, SearchBox } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";

type WeComUserForm = {
  userid: string;
  name: string;
  alias: string;
  mobile: string;
  position: string;
  gender: string;
  email: string;
  telephone: string;
  enable: boolean;
  departmentInput: string;
  orderInput: string;
};

type WeComDepartmentForm = {
  name: string;
  parentid: number;
  order: number;
  name_en: string;
};

const defaultWeComUserForm: WeComUserForm = {
  userid: "",
  name: "",
  alias: "",
  mobile: "",
  position: "",
  gender: "1",
  email: "",
  telephone: "",
  enable: true,
  departmentInput: "",
  orderInput: "",
};

const defaultWeComDepartmentForm: WeComDepartmentForm = {
  name: "",
  parentid: 1,
  order: 1,
  name_en: "",
};

export default function WeComPage() {
  const [tab, setTab] = useState<"users" | "departments">("users");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [joinQrCode, setJoinQrCode] = useState<string>("");
  const [joinQrError, setJoinQrError] = useState("");
  const [joinQrExpanded, setJoinQrExpanded] = useState(false);
  const [joinQrLoading, setJoinQrLoading] = useState(false);
  const [joinQrRequested, setJoinQrRequested] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [userForm, setUserForm] = useState<WeComUserForm>(defaultWeComUserForm);
  const [departmentForm, setDepartmentForm] = useState<WeComDepartmentForm>(defaultWeComDepartmentForm);
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string>("");
  const [syncingDepartments, setSyncingDepartments] = useState(false);
  const [syncingUserDepartments, setSyncingUserDepartments] = useState(false);

  const loadUsers = useCallback(() => AuthService.getWeComUsers(), []);
  const {
    data: users = [],
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useAsyncResource(loadUsers);

  const loadDepartments = useCallback(
    () => AuthService.getWeComDepartments(),
    [],
  );
  const {
    data: departments = [],
    loading: departmentsLoading,
    error: departmentsError,
    reload: reloadDepartments,
  } = useAsyncResource(loadDepartments);

  const loadJoinQrCode = useCallback(async (forceRefresh = false) => {
    if (joinQrLoading || (!forceRefresh && joinQrRequested)) return;
    setJoinQrLoading(true);
    setJoinQrRequested(true);
    setJoinQrError("");
    try {
      const result = await AuthService.getWeComJoinQrCode(3);
      setJoinQrCode(result.joinQrcode || result.join_qrcode || "");
    } catch (error) {
      setJoinQrError(getErrorMessage(error));
    } finally {
      setJoinQrLoading(false);
    }
  }, [joinQrLoading, joinQrRequested]);

  const toggleJoinQr = () => {
    setJoinQrExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (nextExpanded && !joinQrRequested) void loadJoinQrCode();
      return nextExpanded;
    });
  };

  const refreshJoinQrCode = async () => {
    setJoinQrExpanded(true);
    await loadJoinQrCode(true);
  };

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((item) => {
      const text = `${item.userid || ""}${item.name || ""}${item.alias || ""}${item.mobile || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [search, users]);

  const updateUserForm = (key: keyof WeComUserForm, value: string | boolean) => {
    setMessage("");
    setUserForm((current) => ({ ...current, [key]: value }));
  };

  const resetUserForm = () => {
    setSelectedUser("");
    setUserForm(defaultWeComUserForm);
  };

  const buildUserPayload = () => {
    const departments = userForm.departmentInput
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value));
    const order = userForm.orderInput
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value));

    return {
      userid: userForm.userid.trim(),
      name: userForm.name.trim(),
      alias: userForm.alias.trim() || undefined,
      mobile: userForm.mobile.trim() || undefined,
      position: userForm.position.trim() || undefined,
      gender: userForm.gender || undefined,
      email: userForm.email.trim() || undefined,
      telephone: userForm.telephone.trim() || undefined,
      enable: userForm.enable ? 1 : 0,
      department: departments.length ? departments : undefined,
      order: order.length ? order : undefined,
    };
  };

  const selectUser = (user: WeComUser) => {
    setSelectedUser(user.userid);
    setMessage("");
    setUserForm({
      userid: user.userid,
      name: user.name,
      alias: user.alias || "",
      mobile: user.mobile || "",
      position: user.position || "",
      gender: user.gender || "1",
      email: user.email || "",
      telephone: user.telephone || "",
      enable: user.enable === 1,
      departmentInput: Array.isArray(user.department) ? user.department.join(",") : "",
      orderInput: Array.isArray(user.order) ? user.order.join(",") : "",
    });
  };

  const saveUser = async () => {
    const payload = buildUserPayload();
    if (!payload.userid || !payload.name) {
      setMessage("请输入员工账号和姓名");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (selectedUser) {
        await AuthService.updateWeComUser(selectedUser, payload);
        setMessage(`已更新员工 ${payload.name}`);
      } else {
        await AuthService.createWeComUser(payload);
        setMessage(`已新增员工 ${payload.name}`);
      }
      await reloadUsers();
      resetUserForm();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userid: string) => {
    if (!window.confirm(`确认删除企业微信用户 ${userid} 吗？`)) return;
    setDeletingUserId(userid);
    setMessage("");
    try {
      await AuthService.deleteWeComUsers([userid]);
      setMessage(`已删除员工 ${userid}`);
      if (selectedUser === userid) resetUserForm();
      await reloadUsers();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeletingUserId("");
    }
  };

  const startEditDepartment = (department: WeComDepartment) => {
    setEditingDepartmentId(department.id);
    setDepartmentForm({
      name: department.name || "",
      parentid: department.parentid ?? 1,
      order: department.order ?? 1,
      name_en: department.name_en || "",
    });
    setMessage("");
  };

  const resetDepartmentForm = () => {
    setEditingDepartmentId(null);
    setDepartmentForm(defaultWeComDepartmentForm);
  };

  const saveDepartment = async () => {
    if (!departmentForm.name.trim()) {
      setMessage("请输入部门名称");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (editingDepartmentId) {
        await AuthService.updateWeComDepartment(editingDepartmentId, {
          name: departmentForm.name.trim(),
          parentid: departmentForm.parentid,
          order: departmentForm.order,
          name_en: departmentForm.name_en.trim() || undefined,
        });
        setMessage(`已更新部门 ${departmentForm.name}`);
      } else {
        await AuthService.createWeComDepartment({
          name: departmentForm.name.trim(),
          parentid: departmentForm.parentid,
          order: departmentForm.order,
          name_en: departmentForm.name_en.trim() || undefined,
        });
        setMessage(`已创建部门 ${departmentForm.name}`);
      }
      await reloadDepartments();
      resetDepartmentForm();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async (id: number) => {
    if (!window.confirm(`确认删除部门 ${id} 吗？`)) return;
    setSaving(true);
    setMessage("");
    try {
      await AuthService.deleteWeComDepartment(id);
      setMessage(`已删除部门 ${id}`);
      await reloadDepartments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const syncDepartments = async () => {
    setSyncingDepartments(true);
    setMessage("");
    try {
      await AuthService.syncWeComDepartments();
      setMessage("已同步部门结构");
      await reloadDepartments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSyncingDepartments(false);
    }
  };

  const syncUserDepartments = async () => {
    setSyncingUserDepartments(true);
    setMessage("");
    try {
      await AuthService.syncWeComUserDepartments();
      setMessage("已同步员工部门关系");
      await reloadUsers();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSyncingUserDepartments(false);
    }
  };

  return (
    <>
      <AdminHeader title="企业微信管理" description="HR 可在此分享入职二维码、管理员工账号与部门" />
      <section className={styles["wecom-tabs"]}>
        <div className={styles["wecom-tab-buttons"]}>
          <button className={tab === "users" ? styles.active : undefined} onClick={() => setTab("users")}>员工管理</button>
          <button className={tab === "departments" ? styles.active : undefined} onClick={() => setTab("departments")}>部门管理</button>
        </div>
        {message && <div className={cx(styles["admin-message"])}>{message}</div>}
        {tab === "users" ? (
          <WeComUsersSection
            filteredUsers={filteredUsers}
            usersLoading={usersLoading}
            usersError={usersError}
            reloadUsers={reloadUsers}
            joinQrCode={joinQrCode}
            joinQrError={joinQrError}
            joinQrExpanded={joinQrExpanded}
            joinQrLoading={joinQrLoading}
            toggleJoinQr={toggleJoinQr}
            refreshJoinQrCode={refreshJoinQrCode}
            search={search}
            setSearch={setSearch}
            selectedUser={selectedUser}
            userForm={userForm}
            updateUserForm={updateUserForm}
            resetUserForm={resetUserForm}
            saveUser={saveUser}
            deleteUser={deleteUser}
            selectUser={selectUser}
            saving={saving}
            deletingUserId={deletingUserId}
            syncUserDepartments={syncUserDepartments}
            syncingUserDepartments={syncingUserDepartments}
          />
        ) : (
          <WeComDepartmentsSection
            departments={departments}
            departmentsLoading={departmentsLoading}
            departmentsError={departmentsError}
            reloadDepartments={reloadDepartments}
            departmentForm={departmentForm}
            setDepartmentForm={setDepartmentForm}
            editingDepartmentId={editingDepartmentId}
            startEditDepartment={startEditDepartment}
            resetDepartmentForm={resetDepartmentForm}
            saveDepartment={saveDepartment}
            deleteDepartment={deleteDepartment}
            saving={saving}
            syncDepartments={syncDepartments}
            syncingDepartments={syncingDepartments}
          />
        )}
      </section>
    </>
  );
}

function WeComUsersSection({
  filteredUsers,
  usersLoading,
  usersError,
  reloadUsers,
  joinQrCode,
  joinQrError,
  joinQrExpanded,
  joinQrLoading,
  toggleJoinQr,
  refreshJoinQrCode,
  search,
  setSearch,
  selectedUser,
  userForm,
  updateUserForm,
  resetUserForm,
  saveUser,
  deleteUser,
  selectUser,
  saving,
  deletingUserId,
  syncUserDepartments,
  syncingUserDepartments,
}: {
  filteredUsers: WeComUser[];
  usersLoading: boolean;
  usersError: string | null;
  reloadUsers: () => Promise<WeComUser[] | undefined>;
  joinQrCode: string;
  joinQrError: string;
  joinQrExpanded: boolean;
  joinQrLoading: boolean;
  toggleJoinQr: () => void;
  refreshJoinQrCode: () => Promise<void>;
  search: string;
  setSearch: (value: string) => void;
  selectedUser: string;
  userForm: WeComUserForm;
  updateUserForm: (key: keyof WeComUserForm, value: string | boolean) => void;
  resetUserForm: () => void;
  saveUser: () => Promise<void>;
  deleteUser: (userid: string) => Promise<void>;
  selectUser: (user: WeComUser) => void;
  saving: boolean;
  deletingUserId: string;
  syncUserDepartments: () => Promise<void>;
  syncingUserDepartments: boolean;
}) {
  return (
    <div className={styles["wecom-grid"]}>
      <section className={cx(styles["admin-panel"], styles["wecom-qr-panel"])}>
        <div className={styles["panel-heading"]}>
          <div>
            <h2>邀请二维码</h2>
            <p>分享给新员工，填写企业微信入职申请。</p>
          </div>
          <button className={styles["admin-primary-action"]} type="button" onClick={toggleJoinQr} aria-expanded={joinQrExpanded}>
            <QrCode />
            {joinQrExpanded ? "收起二维码" : "显示二维码"}
          </button>
        </div>
        {joinQrExpanded && (
          <div className={styles["wecom-qr-preview"]}>
            {joinQrLoading ? (
              <div className={styles["admin-loading"]}><span className="spinner" />正在加载邀请二维码...</div>
            ) : joinQrCode ? (
              <>
                <img src={joinQrCode} alt="企业微信入职二维码" />
                <div className={styles["wecom-qr-actions"]}>
                  <a className={styles["admin-primary-action"]} href={joinQrCode} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    打开
                  </a>
                  <button className={styles["table-action"]} type="button" onClick={() => navigator.clipboard.writeText(joinQrCode)}>
                    <Copy />
                    复制链接
                  </button>
                  <button className={styles["table-action"]} type="button" disabled={joinQrLoading} onClick={() => void refreshJoinQrCode()}>
                    <RefreshCw />
                    刷新
                  </button>
                </div>
              </>
            ) : joinQrError ? (
              <div className={styles["admin-message"]}>
                <span>{joinQrError}</span>
                <button className={styles["table-action"]} type="button" onClick={() => void refreshJoinQrCode()}>
                  <RefreshCw />
                  刷新
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
      <section className={cx(styles["admin-panel"], styles["wecom-user-panel"])}>
        <div className={styles["panel-heading"]}>
          <div>
            <h2>员工管理</h2>
            <p>搜索、创建、修改或删除企业微信员工。</p>
          </div>
          <div className={styles["panel-actions"]}>
            <button className={styles["admin-primary-action"]} disabled={syncingUserDepartments} onClick={syncUserDepartments}>
              {syncingUserDepartments ? "同步中..." : "同步员工部门关系"}
            </button>
            <button className={styles["admin-primary-action"]} onClick={resetUserForm}>
              新建员工
            </button>
          </div>
        </div>
        <div className={styles["wecom-user-layout"]}>
          <div className={styles["wecom-user-list"]}>
            <div className={styles["panel-actions"]}>
              <SearchBox value={search} onChange={setSearch} placeholder="搜索员工账号、姓名或手机号" />
              <button className={styles["admin-primary-action"]} onClick={() => void reloadUsers()}>
                刷新列表
              </button>
            </div>
            {usersLoading ? (
              <LoadingTable />
            ) : usersError ? (
              <WeComListState message={usersError} retry={() => void reloadUsers()} />
            ) : (
              <div className={styles["table-wrap"]}>
                <table>
                  <thead>
                    <tr>
                      <th>账号</th>
                      <th>姓名</th>
                      <th>手机号</th>
                      <th>部门</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.userid}>
                        <td>{user.userid}</td>
                        <td>{user.name}</td>
                        <td>{user.mobile || "-"}</td>
                        <td>{Array.isArray(user.department) ? user.department.join(",") : "-"}</td>
                        <td>
                          <button className={styles["table-action"]} onClick={() => selectUser(user)}>
                            编辑
                          </button>
                          <button className={styles["table-action"]} disabled={deletingUserId === user.userid} onClick={() => void deleteUser(user.userid)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredUsers.length && (
                      <tr>
                        <td colSpan={5}>没有匹配的员工。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <WeComUserFormCard
            selectedUser={selectedUser}
            userForm={userForm}
            updateUserForm={updateUserForm}
            resetUserForm={resetUserForm}
            saveUser={saveUser}
            saving={saving}
          />
        </div>
      </section>
    </div>
  );
}

function WeComUserFormCard({
  selectedUser,
  userForm,
  updateUserForm,
  resetUserForm,
  saveUser,
  saving,
}: {
  selectedUser: string;
  userForm: WeComUserForm;
  updateUserForm: (key: keyof WeComUserForm, value: string | boolean) => void;
  resetUserForm: () => void;
  saveUser: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className={styles["wecom-user-form"]}>
      <h3>{selectedUser ? "编辑员工" : "创建员工"}</h3>
      <div className={styles["form-grid"]}>
        <label className={styles["admin-field"]}>员工账号<input value={userForm.userid} disabled={Boolean(selectedUser)} onChange={(event) => updateUserForm("userid", event.target.value)} /></label>
        <label className={styles["admin-field"]}>姓名<input value={userForm.name} onChange={(event) => updateUserForm("name", event.target.value)} /></label>
        <label className={styles["admin-field"]}>手机号<input value={userForm.mobile} onChange={(event) => updateUserForm("mobile", event.target.value)} /></label>
        <label className={styles["admin-field"]}>别名<input value={userForm.alias} onChange={(event) => updateUserForm("alias", event.target.value)} /></label>
        <label className={styles["admin-field"]}>职位<input value={userForm.position} onChange={(event) => updateUserForm("position", event.target.value)} /></label>
        <label className={styles["admin-field"]}>邮箱<input value={userForm.email} onChange={(event) => updateUserForm("email", event.target.value)} /></label>
        <label className={styles["admin-field"]}>电话<input value={userForm.telephone} onChange={(event) => updateUserForm("telephone", event.target.value)} /></label>
        <label className={styles["admin-field"]}>部门<input value={userForm.departmentInput} placeholder="例如 1,2" onChange={(event) => updateUserForm("departmentInput", event.target.value)} /></label>
        <label className={styles["admin-field"]}>部门排序<input value={userForm.orderInput} placeholder="例如 10,20" onChange={(event) => updateUserForm("orderInput", event.target.value)} /></label>
        <label className={styles["admin-field"]}>性别<select value={userForm.gender} onChange={(event) => updateUserForm("gender", event.target.value)}><option value="1">男</option><option value="2">女</option><option value="0">未知</option></select></label>
        <label className={styles["admin-field"]}><span>启用</span><input type="checkbox" checked={userForm.enable} onChange={(event) => updateUserForm("enable", event.target.checked)} /></label>
      </div>
      <div className={styles["form-actions"]}>
        <button className={cx(styles["admin-primary-action"], styles["full-width"])} disabled={saving} onClick={() => void saveUser()}>
          {selectedUser ? "保存修改" : "创建员工"}
        </button>
        {selectedUser && <button className={styles["table-action"]} disabled={saving} onClick={resetUserForm}>取消编辑</button>}
      </div>
    </div>
  );
}

function WeComDepartmentsSection({
  departments,
  departmentsLoading,
  departmentsError,
  reloadDepartments,
  departmentForm,
  setDepartmentForm,
  editingDepartmentId,
  startEditDepartment,
  resetDepartmentForm,
  saveDepartment,
  deleteDepartment,
  saving,
  syncDepartments,
  syncingDepartments,
}: {
  departments: WeComDepartment[];
  departmentsLoading: boolean;
  departmentsError: string | null;
  reloadDepartments: () => Promise<WeComDepartment[] | undefined>;
  departmentForm: WeComDepartmentForm;
  setDepartmentForm: Dispatch<SetStateAction<WeComDepartmentForm>>;
  editingDepartmentId: number | null;
  startEditDepartment: (department: WeComDepartment) => void;
  resetDepartmentForm: () => void;
  saveDepartment: () => Promise<void>;
  deleteDepartment: (id: number) => Promise<void>;
  saving: boolean;
  syncDepartments: () => Promise<void>;
  syncingDepartments: boolean;
}) {
  return (
    <div className={styles["wecom-grid"]}>
      <section className={cx(styles["admin-panel"], styles["wecom-department-panel"])}>
        <div className={styles["panel-heading"]}>
          <div>
            <h2>部门管理</h2>
            <p>把企业微信部门结构同步到本地，并创建或修改部门信息。</p>
          </div>
          <div className={styles["panel-actions"]}>
            <button className={styles["admin-primary-action"]} disabled={syncingDepartments} onClick={syncDepartments}>
              {syncingDepartments ? "同步中..." : "同步部门"}
            </button>
          </div>
        </div>
        <div className={styles["wecom-department-layout"]}>
          <div className={styles["wecom-department-list"]}>
            <div className={styles["panel-actions"]}>
              <button className={styles["admin-primary-action"]} onClick={() => void reloadDepartments()}>
                刷新列表
              </button>
            </div>
            {departmentsLoading ? (
              <LoadingTable />
            ) : departmentsError ? (
              <WeComListState message={departmentsError} retry={() => void reloadDepartments()} />
            ) : (
              <div className={styles["table-wrap"]}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>父部门</th>
                      <th>排序</th>
                      <th>名称</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.parentid ?? "-"}</td>
                        <td>{item.order ?? "-"}</td>
                        <td>{item.name || "-"}</td>
                        <td>
                          <button className={styles["table-action"]} onClick={() => startEditDepartment(item)}>
                            编辑
                          </button>
                          <button className={styles["table-action"]} onClick={() => void deleteDepartment(item.id)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!departments.length && (
                      <tr>
                        <td colSpan={5}>没有可用部门数据。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className={styles["wecom-department-form"]}>
            <h3>{editingDepartmentId ? "编辑部门" : "新增部门"}</h3>
            <div className={styles["form-grid"]}>
              <label className={styles["admin-field"]}>名称<input value={departmentForm.name} onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className={styles["admin-field"]}>父部门<input type="number" value={departmentForm.parentid} onChange={(event) => setDepartmentForm((current) => ({ ...current, parentid: Number(event.target.value) }))} /></label>
              <label className={styles["admin-field"]}>排序<input type="number" value={departmentForm.order} onChange={(event) => setDepartmentForm((current) => ({ ...current, order: Number(event.target.value) }))} /></label>
              <label className={styles["admin-field"]}>英文名<input value={departmentForm.name_en} onChange={(event) => setDepartmentForm((current) => ({ ...current, name_en: event.target.value }))} /></label>
            </div>
            <div className={styles["form-actions"]}>
              <button className={cx(styles["admin-primary-action"], styles["full-width"])} disabled={saving} onClick={() => void saveDepartment()}>
                {editingDepartmentId ? "保存部门" : "创建部门"}
              </button>
              {editingDepartmentId && <button className={styles["table-action"]} disabled={saving} onClick={resetDepartmentForm}>取消</button>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function WeComListState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className={styles["wecom-list-state"]}>
      <span>{message}</span>
      <button className={styles["table-action"]} type="button" onClick={retry}>重试</button>
    </div>
  );
}
