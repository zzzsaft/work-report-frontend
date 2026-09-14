import { Alert, Button, EmptyState, TextInput } from "@jc-times/business-ui";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { workReportRepository } from "@/api/services/workReport.service";
import { cx } from "../adminUtils";
import styles from "../AdminPages.module.less";
import type { WorkerSummary } from "../types";

interface WorkerPickerModalProps {
  newOpCode: string;
  onOpCodeChange: (v: string) => void;
  onPicked: (worker: WorkerSummary) => Promise<void>;
  onCancel: () => void;
}

export function WorkerPickerModal({ newOpCode, onOpCodeChange, onPicked, onCancel }: WorkerPickerModalProps) {
  const [keyword, setKeyword] = useState("");
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pick = async (worker: WorkerSummary) => {
    if (!newOpCode.trim()) {
      setError("请先填写工序编码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onPicked(worker);
    } catch (err) {
      setError(err instanceof Error ? err.message : "选择失败");
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await workReportRepository.searchWorkers(keyword, 1, 20);
      setWorkers(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cx(styles["worker-picker-modal"])}>
      <div className={cx(styles["modal-field"])}>

        <TextInput label={<>工序编码 <span className={cx(styles["required-mark"])}>*</span></>}
          value={newOpCode}
          onChange={(e) => onOpCodeChange(e.target.value)}
          placeholder="输入工序编码，如 CJ-JJMC"
          className={cx(styles["mapping-code-input"])}
          autoFocus
        />
      </div>
      <div className={cx(styles["modal-divider"])} />
      <div className={cx(styles["modal-subtitle"])}>选择人员</div>
      <div className={cx(styles["worker-picker-head"])}>
        <TextInput aria-label="搜索姓名/工号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索姓名/工号"
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        />
        <Button aria-label={"搜索"} variant="ghost" className={cx(styles["table-action"])} onClick={() => void search()}>
          <Search />
        </Button>
      </div>
      {loading && <EmptyState className={cx(styles["empty-inline"])} compact title={<>搜索中...</>} />}
      {!loading && error && <Alert className={cx(styles["admin-message"])} tone={"info"} description={<>{error}</>} />}
      {!loading &&
        !error &&
        workers.map((w) => (
          <Button variant="ghost"
            key={w.id}
            className={cx(styles["worker-picker-inline-item"])}
            onClick={() => void pick(w)}
          >
            <span>{w.name.slice(0, 1)}</span>
            <div>
              <strong>{w.name}</strong>
              <small>
                {w.employeeNo} · {w.teamName}
              </small>
            </div>
          </Button>
        ))}
      {!loading && !error && !workers.length && (
        <EmptyState className={cx(styles["empty-inline"])} compact title={<>输入关键词搜索人员</>} />
      )}
      <div className={cx(styles["modal-footer"])}>
        <Button variant="ghost" className={cx(styles["table-action"])} onClick={onCancel}>
          <X />
          取消
        </Button>
      </div>
    </div>
  );
}
