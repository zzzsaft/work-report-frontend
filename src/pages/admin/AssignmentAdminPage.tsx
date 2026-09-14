import { Alert, Button, Checkbox, EmptyState, RovingTabList, RovingTabPanel, SelectInput, TextArea, TextInput, ToggleSwitch } from "@jc-times/business-ui";
import { ReportDialog } from "@/components/ui/ReportDialog";
import { useConfirmation } from "@/components/ui/ConfirmationProvider";
import { ReportTable } from "@/components/ui/ReportTable";
import { useState, useEffect } from "react";
import { Plus, Trash2, Settings, Search, UserPlus, Link2, Unlink, Shield } from "lucide-react";
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
  const confirm = useConfirmation();
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const {
    teams,
    loading,
    selectedTeamId,
    selectTeam,
    members,
    membersLoading,
    showCreateModal,
    setShowCreateModal,
    editingTeam,
    setEditingTeam,
    message,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    batchSetWorkerTeam
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
          <RovingTabList<Tab> groupId="team-settings" label="班组管理视图" value={activeTab} onChange={setActiveTab} options={[{value: "teams", label: "班组管理"}, {value: "operations", label: "班组工序映射"}]} />

          {canViewAdmin && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={16} style={{ color: systemConfig?.teamOperationPermissionEnabled ? "#4a6cf7" : "#999" }} />
              <span style={{ fontSize: 13, color: "#666" }}>工序领取权限校验</span>
              {configLoading ? (
                <span style={{ fontSize: 13, color: "#999" }}>加载中...</span>
              ) : (
                <ToggleSwitch aria-label="工序领取权限校验" children={null} checked={systemConfig?.teamOperationPermissionEnabled ?? false} onChange={() => void handleTogglePermission()} />
              )}
            </div>
          )}
        </div>

        {message && <Alert className={cx(styles["admin-message"])} tone={"info"} description={<>{message}</>} />}

        {activeTab === "teams" ? (
          <RovingTabPanel groupId="team-settings" value="teams"><TeamManagementTab
            teams={teams}
            loading={loading}
            selectedTeamId={selectedTeamId}
            onSelectTeam={selectTeam}
            members={members}
            membersLoading={membersLoading}
            onAddClick={() => setShowCreateModal(true)}
            onEditClick={(team) => setEditingTeam(team)}
            onDeleteClick={async (team) => {
              if (await confirm(`确定要删除班组"${team.name}"吗？此操作将同时移除班组成员关联和工序映射。`, { danger: true })) {
                void deleteTeam(team.id);
              }
            }}
            onAddMember={addMember}
            onRemoveMember={removeMember}
            onBatchAssign={batchSetWorkerTeam}
          /></RovingTabPanel>
        ) : (
          <RovingTabPanel groupId="team-settings" value="operations"><TeamOperationsTab
            teams={teams}
            selectedTeamId={selectedTeamId}
            selectedTeam={selectedTeam}
            onSelectTeam={selectTeam}
          /></RovingTabPanel>
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
  onRemoveMember,
  onBatchAssign
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
  onBatchAssign: (userIds: string[], teamId: string | null) => Promise<void>;
}) {
  const confirm = useConfirmation();
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberKeyword, setMemberKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [batchTargetTeamId, setBatchTargetTeamId] = useState<string>("");

  // 切换班组时清空选择
  useEffect(() => {
    setSelectedMemberIds(new Set());
    setBatchTargetTeamId("");
  }, [selectedTeamId]);

  const toggleMemberSelect = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMemberIds.size === members.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(members.map((m) => m.id)));
    }
  };

  const handleBatchAssign = async () => {
    if (selectedMemberIds.size === 0) return;
    const targetId = batchTargetTeamId === "__unassigned__" ? null : batchTargetTeamId;
    const targetName = targetId === null ? "未分配班组" : teams.find((t) => t.id === targetId)?.name ?? "";
    if (!targetName) return;
    if (!(await confirm(`确定将 ${selectedMemberIds.size} 人分配到"${targetName}"吗？`))) return;
    try {
      await onBatchAssign([...selectedMemberIds], targetId);
      setSelectedMemberIds(new Set());
      setBatchTargetTeamId("");
    } catch {
      /* handled by parent */
    }
  };

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
        <Button variant="primary" className={cx(styles["btn-primary"])} onClick={onAddClick}>
          <Plus />
          新建班组
        </Button>
        <SelectInput
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
        </SelectInput>
        {focusedTeamId && (
          <>
            <Button variant="ghost"
              className={cx(styles["btn-secondary"])}
              onClick={() => setFocusedTeamId(null)}
            >
              退出聚焦
            </Button>
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
          <ReportTable  columns={[{ title: "班组名称" },
{ title: "成员数" },
{ title: "工序数" },
{ title: "操作", width: 120 }]} rows={displayedTeams.map((team) => (
                ({ id: String(team.id), cells: [<><strong>{team.name}</strong></>,
<>{team.users.length}</>,
<>{team.operations.length}</>,
<>{team.name !== "未分配班组" && (
                      <div className={cx(styles["table-actions-row"])}>
                        <Button aria-label={"编辑"} variant="ghost"
                          className={cx(styles["table-action"])}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditClick(team);
                          }}
                          title="编辑"
                        >
                          <Settings />
                        </Button>
                        <Button aria-label={"删除"} variant="danger"
                          className={cx(styles["table-action"], styles["danger-text"])}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(team);
                          }}
                          title="删除"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}</> ], className: cx(selectedTeamId === team.id && styles["team-row-selected"]), onClick: () => handleRowClick(team.id) })
              ))} emptyTitle={"暂无班组"} />
        </div>
      )}

      {currentTeam && (
        <div className={cx(styles["teams-content"])}>
          <div className={cx(styles["content-header"])}>
            <div>
              <h2>{currentTeam.name}</h2>
              {currentTeam.description && <p>{currentTeam.description}</p>}
            </div>
            <Button variant="primary"
              className={cx(styles["btn-primary"])}
              onClick={() => setShowMemberPicker(true)}
              disabled={isUnassigned}
            >
              <UserPlus />
              添加成员
            </Button>
          </div>

          {selectedMemberIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", background: "#f0f4ff", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: "#4a6cf7" }}>已选择 {selectedMemberIds.size} 人</span>
              <SelectInput
                value={batchTargetTeamId}
                onChange={(e) => setBatchTargetTeamId(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="">选择目标班组...</option>
                {teams.filter((t) => t.id !== "team-unassigned").map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="__unassigned__">未分配班组</option>
              </SelectInput>
              <Button
                variant="primary"
                className={cx(styles["btn-primary"])}
                disabled={!batchTargetTeamId}
                onClick={() => { void handleBatchAssign(); }}
              >
                批量分配
              </Button>
              <Button variant="ghost" className={cx(styles["btn-secondary"])} onClick={() => { setSelectedMemberIds(new Set()); setBatchTargetTeamId(""); }}>
                取消
              </Button>
            </div>
          )}

          {membersLoading ? (
            <LoadingTable />
          ) : (
            <div className={cx(styles["table-wrap"])}>
              <ReportTable columns={[{ title: <><Checkbox aria-label="全选" label={null} checked={members.length > 0 && selectedMemberIds.size === members.length} onChange={toggleSelectAll} /></>, width: 40 },
{ title: "工号" },
{ title: "姓名" },
{ title: "姓名首字母" },
{ title: "班组" },
{ title: "操作" }]} rows={members.map((member) => (
                    ({ id: String(member.id), cells: [<><Checkbox aria-label="选择"
                      label={null}
                      checked={selectedMemberIds.has(member.id)}
                      onChange={() => toggleMemberSelect(member.id)}
                    /></>,
<>{member.employeeNo || "—"}</>,
<><strong>{member.name}</strong></>,
<>{member.nameInitials || "—"}</>,
<>{member.teamName || "—"}</>,
<>{!isUnassigned && (
                          <Button variant="danger"
                            className={cx(styles["table-action"], styles["danger-action"])}
                            onClick={() => void onRemoveMember(currentTeam.id, member.id)}
                          >
                            <Unlink />
                            移除
                          </Button>
                        )}</> ] })
                  ))} emptyTitle={"暂无成员"} />
            </div>
          )}
        </div>
      )}

      {showMemberPicker && currentTeam && (
        <ReportDialog title={<>添加成员到 {currentTeam.name}</>} onClose={() => setShowMemberPicker(false)}  ><div className={cx(styles["member-picker-search"])}>
                <TextInput aria-label="搜索姓名/工号"
                  value={memberKeyword}
                  onChange={(e) => setMemberKeyword(e.target.value)}
                  placeholder="搜索姓名/工号"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchMembers();
                  }}
                />
                <Button aria-label={"搜索"} variant="primary" className={cx(styles["btn-primary"])} onClick={() => void searchMembers()}>
                  <Search />
                </Button>
              </div>{searching ? (
                <EmptyState className={cx(styles["empty-inline"])} compact title={<>搜索中...</>} />
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
                      <Button variant="primary"
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
                      </Button>
                    </div>
                  ))}
                  {!searchResults.length && !searching && (
                    <EmptyState className={cx(styles["empty-inline"])} compact title={<>输入关键词搜索人员</>} />
                  )}
                </div>
              )}</ReportDialog>
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
        <SelectInput
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
        </SelectInput>
        {selectedTeam && !isUnassigned && (
          <>
            <TextInput aria-label="输入工序编码"
              value={newOpCode}
              onChange={(e) => setNewOpCode(e.target.value)}
              placeholder="输入工序编码"
              className={cx(styles["operation-code-input"])}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createOperation();
              }}
            />
            <Button variant="primary" className={cx(styles["btn-primary"])} onClick={() => void createOperation()}>
              <Plus />
              添加工序
            </Button>
            <Button variant="ghost" className={cx(styles["btn-secondary"])} onClick={() => void syncOperations()}>
              同步历史数据
            </Button>
            {selectedIds.length > 0 && (
              <Button variant="danger"
                className={cx(styles["danger-action"])}
                onClick={() => void batchDelete()}
              >
                批量删除 ({selectedIds.length})
              </Button>
            )}
          </>
        )}
      </div>

      {message && <Alert className={cx(styles["admin-message"])} tone={"info"} description={<>{message}</>} />}

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
          <ReportTable  columns={[{ title: <><Checkbox aria-label="选择记录"
                    label={null}
                    checked={operations.length > 0 && selectedIds.length === operations.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? operations.map((o) => o.id) : [])
                    }
                  /></>, width: 40 },
{ title: "工序编码" },
{ title: "工序名称" },
{ title: "创建时间" },
{ title: "操作" }]} rows={operations.map((op) => (
                ({ id: String(op.id), cells: [<><Checkbox aria-label="选择记录"
                      label={null}
                      checked={selectedIds.includes(op.id)}
                      onChange={() => toggleSelect(op.id)}
                    /></>,
<><strong>{op.operationCode}</strong></>,
<>{op.operationName || "—"}</>,
<>{new Date(op.createdAt).toLocaleString("zh-CN")}</>,
<><Button variant="danger"
                      className={cx(styles["table-action"], styles["danger-action"])}
                      onClick={() => void deleteOperation(op.id)}
                    >
                      <Trash2 />
                      删除
                    </Button></> ] })
              ))} emptyTitle={"该班组暂无关联工序"} />
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
    <ReportDialog title={<>{team ? "编辑班组" : "新建班组"}</>} onClose={onClose} busy={submitting} footer={<><Button variant="ghost" className={cx(styles["table-action"])} onClick={onClose} disabled={submitting}>
            取消
          </Button><Button variant="primary" className={cx(styles["btn-primary"])} onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "保存中..." : "保存"}
          </Button></>}><div className={cx(styles["modal-field"])}>

            <TextInput label={<>班组名称 <span className={cx(styles["required-mark"])}>*</span></>}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入班组名称"
              autoFocus
            />
          </div><div className={cx(styles["modal-field"])}>

            <TextArea label={<>描述</>}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选，班组描述信息"
              rows={3}
            />
          </div>{error && <Alert className={cx(styles["admin-message"])} tone={"info"} description={<>{error}</>} />}</ReportDialog>
  );
}
