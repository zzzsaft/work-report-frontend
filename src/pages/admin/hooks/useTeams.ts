import { useCallback, useState } from "react";
import { workReportRepository } from "@/api/services/workReport.service";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { TeamInfo, TeamMember } from "../types";

export function useTeams() {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamInfo | null>(null);
  const [message, setMessage] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const loadTeams = useCallback(
    async () => workReportRepository.listTeams(),
    []
  );
  const { data: teams = [], loading, error, reload } = useAsyncResource<TeamInfo[]>(loadTeams);

  const selectTeam = useCallback(async (teamId: string) => {
    setSelectedTeamId(teamId);
    setMembersLoading(true);
    try {
      const result = await workReportRepository.getTeamMembers(teamId);
      setMembers(result);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载班组成员失败");
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const createTeam = async (name: string, description?: string) => {
    try {
      const team = await workReportRepository.createTeam(name, description);
      setMessage(`班组"${name}"创建成功`);
      await reload();
      return team;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "创建班组失败");
      throw err;
    }
  };

  const updateTeam = async (id: string, name: string, description?: string) => {
    try {
      const team = await workReportRepository.updateTeam(id, name, description);
      setMessage(`班组"${name}"更新成功`);
      await reload();
      if (selectedTeamId === id) {
        await selectTeam(id);
      }
      return team;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "更新班组失败");
      throw err;
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await workReportRepository.deleteTeam(id);
      setMessage("班组删除成功");
      setSelectedTeamId(null);
      setMembers([]);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除班组失败");
      throw err;
    }
  };

  const addMember = async (teamId: string, userId: string) => {
    try {
      await workReportRepository.addTeamMember(teamId, userId);
      setMessage("添加成员成功");
      await Promise.all([reload(), selectTeam(teamId)]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "添加成员失败");
      throw err;
    }
  };

  const removeMember = async (teamId: string, userId: string) => {
    try {
      await workReportRepository.removeTeamMember(teamId, userId);
      setMessage("移除成员成功");
      await Promise.all([reload(), selectTeam(teamId)]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "移除成员失败");
      throw err;
    }
  };

  return {
    teams,
    loading,
    error,
    reload,
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
  };
}
