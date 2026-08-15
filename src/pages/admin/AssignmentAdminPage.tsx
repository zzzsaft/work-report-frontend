import { useState, useEffect } from "react";
import { Plus, Trash2, Users, Settings, Search, X, UserPlus, Link2, Unlink, Shield } from "lucide-react";
import { AdminHeader, LoadingTable } from "./adminShared";
import { cx } from "./adminUtils";
import styles from "./AdminPages.module.less";
import { useTeams } from "./hooks/useTeams";
import { useTeamOperations } from "./hooks/useTeamOperations";
import type { TeamInfo, TeamMember } from "./types";
import { workReportRepository } from "@/api/services/workReport.service";
import { useWorkReportStore } from "@/store/useWorkReportStore";
import type { SystemConfig } from "@/domain/work-report";

type Tab = "teams" | "operations";

export default function AssignmentAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const {
    teams,
    loading,
    selectedTeamId,
    setSelectedTeamId,
    selectTeam,
    members,
    membersLoading,
    showCreateModal,
    setShowCreateModal,
    editingTeam,
    setEditingTeam,
    message,
    setMessage,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember
  } = useTeams();

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  const capabilities = useWorkReportStore((s) => s.capabilities);
  const canViewAdmin = capabilities?.canViewAdmin ?? false;

  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    if (!canViewAdmin) return;
    void (async () => {
      try {
        const config = await workReportRepository.getSystemConfig();
        setSystemConfig(config);
      } catch {
        /* ignore */
      } finally {
        setConfigLoading(false);
      }
    })();
  }, [canViewAdmin]);

  const handleTogglePermission = async () => {
    if (!systemConfig) return;
    const next = !systemConfig.teamOperationPermissionEnabled;
    try {
      const updated = await workReportRepository.saveSystemConfig({ teamOperationPermissionEnabled: next });
      setSystemConfig(updated);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <AdminHeader title="人员工序映射" description="班组与人员、工序的关系管理" />

      <div className={cx(styles["tab-container"])}>
        <div className={cx(styles["tab-header"])}>
          <button
            className={cx(styles["tab-btn"], activeTab === "teams" && styles["tab-active"])}
            onClick={() => setActiveTab("teams")}
          >
            <Users />
            班组管理
          </button>
          <button
            className={cx(styles["tab-btn"], activeTab === "operations" && styles["tab-active"])}
            onClick={() => setActiveTab("operations")}
          >
            <Link2 />
            班组工序映射
          </button>
          {canViewAdmin && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={16} style={{ color: systemConfig?.teamOperationPermissionEnabled ? "#4a6cf7" : "#999" }} />
              <span style={{ fontSize: 13, color: "#666" }}>工序领取权限校验</span>
              {configLoading ? (
                <span style={{ fontSize: 13, color: "#999" }}>加载中...</span>
              ) : (
                <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={systemConfig?.teamOperationPermissionEnabled ?? false}
                    onChange={() => void handleTogglePermission()}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: systemConfig?.teamOperationPermissionEnabled ? "#4a6cf7" : "#ccc",
                      borderRadius: 22,
                      transition: "0.3s"
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      content: "",
                      height: 16,
                      width: 16,
                      left: systemConfig?.teamOperationPermissionEnabled ? 22 : 3,
                      bottom: 3,
                      backgroundColor: "#fff",
                      borderRadius: "50%",
                      transition: "0.3s"
                    }}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {message && <div className={cx(styles["admin-message"])}>{message}</div>}

        {activeTab === "teams" ? (
          <TeamManagementTab
            teams={teams}
            loading={loading}
            selectedTeamId={selectedTeamId}
            onSelectTeam={selectTeam}
            members={members}
            membersLoading={membersLoading}
            onAddClick={() => setShowCreateModal(true)}
            onEditClick={(team) => setEditingTeam(team)}
            onDeleteClick={(team) => {
              if (confirm(`确定要删除班组"${team.name}"吗？此操作将同时移除班组成员关联和工序映射。`)) {
                void deleteTeam(team.id);
              }
            }}
            onAddMember={addMember}
            onRemoveMember={removeMember}
          />
        ) : (
          <TeamOperationsTab
            teams={teams}
            selectedTeamId={selectedTeamId}
            selectedTeam={selectedTeam}
            onSelectTeam={selectTeam}
          />
        )}
      </div>

      {showCreateModal && (
        <TeamFormModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(name, desc) => createTeam(name, desc)}
        />
      )}

      {editingTeam && (
        <TeamFormModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSubmit={(name, desc) => updateTeam(editingTeam.id, name, desc)}
        />
      )}
    </>
  );
}

function TeamManagementTab({
  teams,
  loading,
  selectedTeamId,
  onSelectTeam,
  members,
  membersLoading,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onAddMember,
  onRemoveMember
}: {
  teams: TeamInfo[];
  loading: boolean;
  selectedTeamId: string | null;
  onSelectTeam: (id: string) => Promise<void>;
  members: TeamMember[];
  membersLoading: boolean;
  onAddClick: () => void;
  onEditClick: (team: TeamInfo) => void;
  onDeleteClick: (team: TeamInfo) => void;
  onAddMember: (teamId: string, userId: string) => Promise<void>;
  onRemoveMember: (teamId: string, userId: string) => Promise<void>;
}) {
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);

  const handleRowClick = (teamId: string) => {
    if (focusedTeamId === teamId) {
      // 再次点击同一行：取消聚焦
      setFocusedTeamId(null);
    } else {
      // 首次点击或点击其他行：聚焦该行
      setFocusedTeamId(teamId);
    }
    void onSelectTeam(teamId);
  };

  const displayedTeams = focusedTeamId
    ? teams.filter((t) => t.id === focusedTeamId)
    : teams;

  const searchMembers = async () => {
    setSearching(true);
    try {
      const result = await workReportRepository.searchWorkers(memberKeyword, 1, 20);
      setSearchResults(result.items.map((w) => ({
        id: w.id,
        name: w.name,
        employeeNo: w.employeeNo || null,
        teamName: w.teamName || null,
        nameInitials: w.nameInitials || null
      })));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const currentTeam = teams.find((t) => t.id === selectedTeamId);
  const isUnassigned = currentTeam?.id === "team-unassigned";

  return (
    <div className={cx(styles["teams-main"])}>
      <div className={cx(styles["teams-toolbar"])}>
        <button className={cx(styles["btn-primary"])} onClick={onAddClick}>
          <Plus />
          新建班组
        </button>
        <select
          value={selectedTeamId || ""}
          onChange={(e) => void onSelectTeam(e.target.value)}
          className={cx(styles["team-select"])}
        >
          <option value="">选择班组</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {focusedTeamId && (
          <>
            <button
              className={cx(styles["btn-secondary"])}
              onClick={() => setFocusedTeamId(null)}
            >
              退出聚焦
            </button>
            <span style={{ fontSize: 13, color: "#4a6cf7" }}>
              聚焦模式：仅显示选中班组，再次点击该行可取消
            </span>
          </>
        )}
      </div>

      {loading ? (
        <LoadingTable />
      ) : (
        <div className={cx(styles["teams-table-wrap"])}>
          <table>
            <thead>
              <tr>
                <th>班组名称</th>
                <th>成员数</th>
                <th>工序数</th>
                <th style={{ width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {displayedTeams.map((team) => (
                <tr
                  key={team.id}
                  className={cx(selectedTeamId === team.id && styles["team-row-selected"])}
                  onClick={() => handleRowClick(team.id)}
                >
                  <td>
                    <strong>{team.name}</strong>
                  </td>
                  <td>{team.users.length}</td>
                  <td>{team.operations.length}</td>
                  <td>
                    {team.name !== "未分配班组" && (
                      <div className={cx(styles["table-actions-row"])}>
                        <button
                          className={cx(styles["table-action"])}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditClick(team);
                          }}
                          title="编辑"
                        >
                          <Settings />
                        </button>
                        <button
                          className={cx(styles["table-action"], styles["danger-text"])}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(team);
                          }}
                          title="删除"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!teams.length && !focusedTeamId && (
                <tr>
                  <td colSpan={4} className={cx(styles["empty-inline"])}>
                    暂无班组
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {currentTeam && (
        <div className={cx(styles["teams-content"])}>
          <div className={cx(styles["content-header"])}>
            <div>
              <h2>{currentTeam.name}</h2>
              {currentTeam.description && <p>{currentTeam.description}</p>}
            </div>
            <button
              className={cx(styles["btn-primary"])}
              onClick={() => setShowMemberPicker(true)}
              disabled={isUnassigned}
            >
              <UserPlus />
              添加成员
            </button>
          </div>

          {membersLoading ? (
            <LoadingTable />
          ) : (
            <div className={cx(styles["table-wrap"])}>
              <table>
                <thead>
                  <tr>
                    <th>工号</th>
                    <th>姓名</th>
                    <th>姓名首字母</th>
                    <th>班组</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>{member.employeeNo || "—"}</td>
                      <td>
                        <strong>{member.name}</strong>
                      </td>
                      <td>{member.nameInitials || "—"}</td>
                      <td>{member.teamName || "—"}</td>
                      <td>
                        {!isUnassigned && (
                          <button
                            className={cx(styles["table-action"], styles["danger-action"])}
                            onClick={() => void onRemoveMember(currentTeam.id, member.id)}
                          >
                            <Unlink />
                            移除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!members.length && (
                    <tr>
                      <td colSpan={5} className={cx(styles["empty-inline"])}>
                        暂无成员
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showMemberPicker && currentTeam && (
        <div
          className={cx(styles["modal-overlay"])}
          onClick={() => setShowMemberPicker(false)}
        >
          <div
            className={cx(styles["modal-content"], styles["modal-md"])}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cx(styles["modal-header"])}>
              <h3>添加成员到 {currentTeam.name}</h3>
              <button className={cx(styles["modal-close"])} onClick={() => setShowMemberPicker(false)}>
                <X />
              </button>
            </div>
            <div className={cx(styles["modal-body"])}>
              <div className={cx(styles["member-picker-search"])}>
                <input
                  value={memberKeyword}
                  onChange={(e) => setMemberKeyword(e.target.value)}
                  placeholder="搜索姓名/工号"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchMembers();
                  }}
                />
                <button className={cx(styles["btn-primary"])} onClick={() => void searchMembers()}>
                  <Search />
                </button>
              </div>
              {searching ? (
                <div className={cx(styles["empty-inline"])}>搜索中...</div>
              ) : (
                <div className={cx(styles["member-picker-list"])}>
                  {searchResults.map((worker) => (
                    <div key={worker.id} className={cx(styles["member-picker-item"])}>
                      <span>{worker.name.slice(0, 1)}</span>
                      <div>
                        <strong>{worker.name}</strong>
                        <small>
                          {worker.employeeNo} · {worker.teamName || "无班组"}
                        </small>
                      </div>
                      <button
                        className={cx(styles["btn-primary"])}
                        onClick={async () => {
                          try {
                            await onAddMember(currentTeam.id, worker.id);
                            setShowMemberPicker(false);
                            setMemberKeyword("");
                            setSearchResults([]);
                          } catch {
                            /* error handled by hook */
                          }
                        }}
                      >
                        添加
                      </button>
                    </div>
                  ))}
                  {!searchResults.length && !searching && (
                    <div className={cx(styles["empty-inline"])}>输入关键词搜索人员</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamOperationsTab({
  teams,
  selectedTeamId,
  selectedTeam,
  onSelectTeam
}: {
  teams: TeamInfo[];
  selectedTeamId: string | null;
  selectedTeam: TeamInfo | null;
  onSelectTeam: (id: string) => Promise<void>;
}) {
  const isUnassigned = selectedTeamId === "team-unassigned";
  const {
    operations,
    loading,
    selectedIds,
    setSelectedIds,
    message,
    setMessage: setOpMessage,
    newOpCode,
    setNewOpCode,
    createOperation,
    deleteOperation,
    batchDelete,
    syncOperations,
    toggleSelect
  } = useTeamOperations(selectedTeamId);

  return (
    <div className={cx(styles["operations-layout"])}>
      <div className={cx(styles["operations-toolbar"])}>
        <select
          value={selectedTeamId || ""}
          onChange={(e) => void onSelectTeam(e.target.value)}
          className={cx(styles["team-select"])}
        >
          <option value="">选择班组</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {selectedTeam && !isUnassigned && (
          <>
            <input
              value={newOpCode}
              onChange={(e) => setNewOpCode(e.target.value)}
              placeholder="输入工序编码"
              className={cx(styles["operation-code-input"])}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createOperation();
              }}
            />
            <button className={cx(styles["btn-primary"])} onClick={() => void createOperation()}>
              <Plus />
              添加工序
            </button>
            <button className={cx(styles["btn-secondary"])} onClick={() => void syncOperations()}>
              同步历史数据
            </button>
            {selectedIds.length > 0 && (
              <button
                className={cx(styles["danger-action"])}
                onClick={() => void batchDelete()}
              >
                批量删除 ({selectedIds.length})
              </button>
            )}
          </>
        )}
      </div>

      {message && <div className={cx(styles["admin-message"])}>{message}</div>}

      {!selectedTeam ? (
        <div className={cx(styles["empty-state"])}>
          <Link2 />
          <p>请先选择一个班组，然后为其配置可执行的工序</p>
        </div>
      ) : isUnassigned ? (
        <div className={cx(styles["empty-state"])}>
          <Link2 />
          <p>未分配班组不可配置工序，请选择具体班组</p>
        </div>
      ) : loading ? (
        <LoadingTable />
      ) : (
        <div className={cx(styles["table-wrap"])}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={operations.length > 0 && selectedIds.length === operations.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? operations.map((o) => o.id) : [])
                    }
                  />
                </th>
                <th>工序编码</th>
                <th>工序名称</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => (
                <tr key={op.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(op.id)}
                      onChange={() => toggleSelect(op.id)}
                    />
                  </td>
                  <td>
                    <strong>{op.operationCode}</strong>
                  </td>
                  <td>{op.operationName || "—"}</td>
                  <td>{new Date(op.createdAt).toLocaleString("zh-CN")}</td>
                  <td>
                    <button
                      className={cx(styles["table-action"], styles["danger-action"])}
                      onClick={() => void deleteOperation(op.id)}
                    >
                      <Trash2 />
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {!operations.length && (
                <tr>
                  <td colSpan={5} className={cx(styles["empty-inline"])}>
                    该班组暂无关联工序
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeamFormModal({
  team,
  onClose,
  onSubmit
}: {
  team?: TeamInfo;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<TeamInfo | void>;
}) {
  const [name, setName] = useState(team?.name || "");
  const [description, setDescription] = useState(team?.description || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("班组名称不能为空");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(name.trim(), description.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cx(styles["modal-overlay"])} onClick={onClose}>
      <div className={cx(styles["modal-content"], styles["modal-sm"])} onClick={(e) => e.stopPropagation()}>
        <div className={cx(styles["modal-header"])}>
          <h3>{team ? "编辑班组" : "新建班组"}</h3>
          <button className={cx(styles["modal-close"])} onClick={onClose}>
            <X />
          </button>
        </div>
        <div className={cx(styles["modal-body"])}>
          <div className={cx(styles["modal-field"])}>
            <label>
              班组名称 <span className={cx(styles["required-mark"])}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入班组名称"
              autoFocus
            />
          </div>
          <div className={cx(styles["modal-field"])}>
            <label>描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选，班组描述信息"
              rows={3}
            />
          </div>
          {error && <div className={cx(styles["admin-message"])}>{error}</div>}
        </div>
        <div className={cx(styles["modal-footer"])}>
          <button className={cx(styles["table-action"])} onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button className={cx(styles["btn-primary"])} onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
