import axios from "axios";

const configuredLaborTarget = import.meta.env.VITE_MSG_PROXY_TARGET?.trim().replace(/\/+$/, "");
const resolveLaborDataUrl = (path: string) => configuredLaborTarget ? `${configuredLaborTarget}${path}` : path;

export const externalLaborClient = axios.create({
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface LaborData {
  JobNum: string;
  AssemblySeq: number;
  OprSeq: number;
  OpCode: string;
  EmployeeNum: string;
  indate: string;
  outdate: string;
}

export async function getLaborData(jobNum: string, assemblySeq: number | string, oprSeq: number | string): Promise<LaborData[]> {
  const url = resolveLaborDataUrl("/Msg/LaborData");
  const params = {
    JobNum: jobNum,
    AssemblySeq: typeof assemblySeq === "string" ? parseInt(assemblySeq, 10) : assemblySeq,
    OprSeq: typeof oprSeq === "string" ? parseInt(oprSeq, 10) : oprSeq,
  };
  const response = await externalLaborClient.get<LaborData[]>(url, { params });
  return response.data;
}

const formatDateTimeLocalFromDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseLaborDateTime = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr || dateStr.trim() === "") return null;
  const normalized = dateStr.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/, "$1T$2");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * 获取工序开工/完工时间。
 * - 接口返回有效数据时，使用接口返回的 indate/outdate
 * - 接口无内容或调用失败时：完工时间取当前时间，开工时间 = 当前时间 - 标准工时
 */
export async function getOperationTimes(
  jobNum: string,
  assemblySeq: string | number,
  oprSeq: string | number,
  estimatedHours?: number
): Promise<{ startTime: string; endTime: string }> {
  const now = new Date();
  const stdMs = Math.max(0, estimatedHours ?? 0) * 3600_000;

  const fallbackByStdHours = () => {
    const endTime = formatDateTimeLocalFromDate(now);
    const start = new Date(now.getTime() - stdMs);
    return { startTime: formatDateTimeLocalFromDate(start), endTime };
  };

  try {
    const laborData = await getLaborData(jobNum, assemblySeq, oprSeq);

    if (!laborData || laborData.length === 0) {
      return fallbackByStdHours();
    }

    const data = laborData[0];
    const startDate = parseLaborDateTime(data.indate);
    const endDate = parseLaborDateTime(data.outdate);

    // 接口返回了记录但时间为空，按标准工时计算
    if (!startDate && !endDate) {
      return fallbackByStdHours();
    }

    return {
      startTime: startDate ? formatDateTimeLocalFromDate(startDate) : "",
      endTime: endDate ? formatDateTimeLocalFromDate(endDate) : "",
    };
  } catch {
    return fallbackByStdHours();
  }
}
