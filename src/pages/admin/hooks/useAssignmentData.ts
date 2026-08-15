import { useCallback, useState } from "react";
import { workReportRepository } from "@/api/services/workReport.service";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { ConfirmDelete, OperationWorkerAssignment, UnmappedWorker, WorkerSummary } from "../types";

const PAGE_SIZE = 10;

export function useAssignmentData() {
  const [mappingKeyword, setMappingKeyword] = useState("");
  const [newOpCode, setNewOpCode] = useState("");
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [selectedMappingIds, setSelectedMappingIds] = useState<string[]>([]);
  const [mappingMessage, setMappingMessage] = useState("");
  const [mappingPage, setMappingPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete>(null);
  const [deleting, setDeleting] = useState(false);

  const [unmappedKeyword, setUnmappedKeyword] = useState("");
  const [unmappedPage, setUnmappedPage] = useState(0);

  const loadMappings = useCallback(
    async () => {
      setMappingPage(0);
      return workReportRepository.getOperationWorkerAssignments(mappingKeyword || undefined);
    },
    [mappingKeyword]
  );
  const { data: mappings = [], loading: mappingsLoading, reload: reloadMappings } = useAsyncResource<
    OperationWorkerAssignment[]
  >(loadMappings);

  const loadUnmapped = useCallback(
    async () => workReportRepository.getUnmappedWorkers(unmappedKeyword, unmappedPage + 1, PAGE_SIZE),
    [unmappedKeyword, unmappedPage]
  );
  const { data: unmappedResult, loading: unmappedLoading } = useAsyncResource<{
    items: UnmappedWorker[];
    total: number;
  }>(loadUnmapped);
  const unmappedWorkers = unmappedResult?.items ?? [];
  const unmappedTotalPages = Math.max(1, Math.ceil((unmappedResult?.total ?? 0) / PAGE_SIZE));

  const addMapping = async (worker: WorkerSummary) => {
    if (!newOpCode.trim()) {
      setMappingMessage("请先输入工序编码");
      return;
    }
    try {
      await workReportRepository.createOperationWorkerAssignment({
        operationCode: newOpCode.trim().toUpperCase(),
        workerId: worker.id,
        workerName: worker.name
      });
      setMappingMessage(`已添加 ${newOpCode} → ${worker.name}`);
      setNewOpCode("");
      setShowWorkerPicker(false);
      await reloadMappings();
    } catch (err) {
      setMappingMessage(err instanceof Error ? err.message : "添加失败");
    }
  };

  const deleteMapping = async (id: string) => {
    try {
      const result = await workReportRepository.deleteOperationWorkerAssignment(id);
      setMappingMessage(`已删除 ${result.count} 条工单记录`);
      setSelectedMappingIds((prev) => prev.filter((x) => x !== id));
      await reloadMappings();
    } catch (err) {
      setMappingMessage(err instanceof Error ? err.message : "删除失败");
    }
  };

  const batchDelete = async () => {
    if (!selectedMappingIds.length) return;
    try {
      const result = await workReportRepository.batchDeleteOperationWorkerAssignments(selectedMappingIds);
      setMappingMessage(`已删除 ${result.count} 条工单记录`);
      setSelectedMappingIds([]);
      await reloadMappings();
    } catch (err) {
      setMappingMessage(err instanceof Error ? err.message : "批量删除失败");
    }
  };

  const confirmAndDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.type === "single") {
        await deleteMapping(confirmDelete.id);
      } else {
        await batchDelete();
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedMappingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const mappingTotalPages = Math.max(1, Math.ceil(mappings.length / PAGE_SIZE));
  const pagedMappings = mappings.slice(mappingPage * PAGE_SIZE, (mappingPage + 1) * PAGE_SIZE);

  return {
    PAGE_SIZE,
    mappingKeyword,
    setMappingKeyword,
    newOpCode,
    setNewOpCode,
    showWorkerPicker,
    setShowWorkerPicker,
    selectedMappingIds,
    setSelectedMappingIds,
    mappingMessage,
    setMappingMessage,
    mappingPage,
    setMappingPage,
    confirmDelete,
    setConfirmDelete,
    deleting,
    unmappedKeyword,
    setUnmappedKeyword,
    unmappedPage,
    setUnmappedPage,
    mappings,
    mappingsLoading,
    unmappedWorkers,
    unmappedLoading,
    unmappedTotalPages,
    unmappedResult,
    mappingTotalPages,
    pagedMappings,
    addMapping,
    toggleSelect,
    confirmAndDelete,
    reloadMappings
  };
}
