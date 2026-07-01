import axios from "axios";

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
  const url = `/Msg/LaborData`;
  const params = {
    JobNum: jobNum,
    AssemblySeq: typeof assemblySeq === "string" ? parseInt(assemblySeq, 10) : assemblySeq,
    OprSeq: typeof oprSeq === "string" ? parseInt(oprSeq, 10) : oprSeq,
  };
  const response = await externalLaborClient.get<LaborData[]>(url, { params });
  return response.data;
}

export async function getOperationTimes(jobNum: string, assemblySeq: string | number, oprSeq: string | number): Promise<{ startTime: string; endTime: string }> {
  try {
    const laborData = await getLaborData(jobNum, assemblySeq, oprSeq);

    const formatDateTimeLocal = (dateStr: string | null): string => {
      if (!dateStr || dateStr.trim() === "") return "";
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    if (!laborData || laborData.length === 0) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const nowStr = `${year}-${month}-${day}T${hours}:${minutes}`;
      return { startTime: nowStr, endTime: nowStr };
    }

    const data = laborData[0];
    return {
      startTime: formatDateTimeLocal(data.indate),
      endTime: formatDateTimeLocal(data.outdate),
    };
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const nowStr = `${year}-${month}-${day}T${hours}:${minutes}`;
    return { startTime: nowStr, endTime: nowStr };
  }
}