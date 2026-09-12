import { useCallback } from "react";
import { workReportRepository } from "@/api/services/workReport.service";
import type { TeamOperationStat } from "@/api/services/workReport.repository";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { CompanyFilter } from "../types";

export function useTeamOperationStats(company: CompanyFilter, teamName: string) {
  const load = useCallback(
    async () => workReportRepository.getTeamOperationStats(company || undefined, teamName || undefined),
    [company, teamName]
  );

  const { data: rows = [], loading, error, reload } = useAsyncResource<TeamOperationStat[]>(load);

  return { rows, loading, error, reload };
}
