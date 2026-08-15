import { useCallback, useEffect, useState } from "react";
import { workReportRepository } from "@/api/services/workReport.service";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { CompanyFilter, Period, StaffStat } from "../types";

export function useStaffStats() {
  const [period, setPeriod] = useState<Period>("month");
  const [company, setCompany] = useState<CompanyFilter>("");
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");

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

  const filteredOptions = searchKeyword
    ? nameOptions.filter((n) => n.toLowerCase().includes(searchKeyword.toLowerCase()))
    : nameOptions;

  const toggleName = (name: string) => {
    setSelectedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const removeName = (name: string) => {
    setSelectedNames((prev) => prev.filter((n) => n !== name));
  };

  const selectAll = () => {
    if (selectedNames.length === nameOptions.length) {
      setSelectedNames([]);
    } else {
      setSelectedNames([...nameOptions]);
    }
  };

  return {
    period,
    setPeriod,
    company,
    setCompany,
    selectedNames,
    setSelectedNames,
    dropdownOpen,
    setDropdownOpen,
    nameOptions,
    searchKeyword,
    setSearchKeyword,
    staff,
    loading,
    error,
    reload,
    maxHours,
    totalHours,
    periodLabel,
    filteredOptions,
    toggleName,
    removeName,
    selectAll
  };
}
