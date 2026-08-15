import { useCallback, useState } from "react";
import { workReportRepository } from "@/api/services/workReport.service";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { TeamOperation } from "../types";

export function useTeamOperations(teamId: string | null) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [newOpCode, setNewOpCode] = useState("");

  const isUnassigned = teamId === "team-unassigned";

  const load = useCallback(
    async () => {
      if (!teamId || isUnassigned) return [];
      return workReportRepository.listTeamOperations(teamId);
    },
    [teamId, isUnassigned]
  );
  const { data: operations = [], loading, reload } = useAsyncResource<TeamOperation[]>(load);

  const createOperation = async () => {
    if (!teamId || isUnassigned) return;
    if (!newOpCode.trim()) {
      setMessage("请先输入工序编码");
      return;
    }
    try {
      await workReportRepository.createTeamOperation(teamId, newOpCode.trim().toUpperCase());
      setMessage(`工序 ${newOpCode} 添加成功`);
      setNewOpCode("");
      setSelectedIds([]);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "添加工序失败");
    }
  };

  const deleteOperation = async (id: string) => {
    try {
      await workReportRepository.deleteTeamOperation(id);
      setMessage("工序删除成功");
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除工序失败");
    }
  };

  const batchDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await workReportRepository.batchDeleteTeamOperations(selectedIds);
      setMessage(`已删除 ${selectedIds.length} 条工序`);
      setSelectedIds([]);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "批量删除失败");
    }
  };

  const syncOperations = async () => {
    try {
      const result = await workReportRepository.syncTeamOperations();
      setMessage(`已同步 ${result.count} 条工序映射`);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "同步失败");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return {
    operations,
    loading,
    reload,
    selectedIds,
    setSelectedIds,
    message,
    setMessage,
    newOpCode,
    setNewOpCode,
    createOperation,
    deleteOperation,
    batchDelete,
    syncOperations,
    toggleSelect
  };
}
