import { useCallback, useEffect, useState } from "react";
import { workReportRepository } from "@/api/services/workReport.service";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { CompanyFilter, Period, StaffStat } from "../types";

export function useStaffStats() {
  const [period, setPeriod] = useState<Period>("month");
  const [company, setCompany] = useState<CompanyFilter>("");
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [nameOptions, setNameOptions] = useState<string[]>([]);

  useEffect(() => {
    workReportRepository
      .listOperationNames(period, company || undefined)
      .then(setNameOptions)
      .catch(() => setNameOptions([]));
    setSelectedNames([]);
  }, [period, company]);

  const load = useCallback(
    async () => workReportRepository.getStaffStats(period, selectedNames.length ? selectedNames : undefined, company || undefined),
    [period, selectedNames, company]
  );
  const { data: staff = [], loading, error, reload } = useAsyncResource<StaffStat[]>(load);

  const maxHours = Math.max(1, ...staff.map((s) => s.totalHours));
  const totalHours = staff.reduce((sum, s) => sum + s.totalHours, 0);
  const periodLabel = period === "lastMonth" ? "上月" : "本月";

  return {
    period,
    setPeriod,
    company,
    setCompany,
    selectedNames,
    setSelectedNames,
    nameOptions,
    staff,
    loading,
    error,
    reload,
    maxHours,
    totalHours,
    periodLabel,
  };
}
