const DEFAULT_BASE_URL = "http://localhost:2020";
const DEFAULT_TOKEN = "mock-token";
const DEFAULT_SEED_PATH = "/dev/work-hours/seed";

const baseUrl = (process.env.BASE_URL || process.env.VITE_WORK_REPORT_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const token = process.env.TOKEN || process.env.WORK_REPORT_TOKEN || DEFAULT_TOKEN;
const seedPath = process.env.SEED_PATH || DEFAULT_SEED_PATH;

const dayMs = 24 * 60 * 60 * 1000;

function localDateKey(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * dayMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(dateKey) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  const day = date.getDay() || 7;
  return new Date(date.getTime() - (day - 1) * dayMs);
}

function sameMonth(left, right) {
  return left.slice(0, 7) === right.slice(0, 7);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

const worker = {
  id: "mock-worker-001",
  employeeNo: "EMP-MOCK-001",
  name: "张师傅",
  teamName: "统计测试组",
};

const hourPlan = [
  { offset: 0, operation: "终检前倒角", regularHours: 8, overtimeHours: 1.25, completedQuantity: 40 },
  { offset: -1, operation: "清洗包装", regularHours: 8, overtimeHours: 0.5, completedQuantity: 36 },
  { offset: -2, operation: "端盖钻孔", regularHours: 7.5, overtimeHours: 0, completedQuantity: 28 },
  { offset: -3, operation: "壳体精铣", regularHours: 8, overtimeHours: 2, completedQuantity: 32 },
  { offset: -4, operation: "法兰攻丝", regularHours: 8, overtimeHours: 0.75, completedQuantity: 52 },
  { offset: -5, operation: "去毛刺", regularHours: 6, overtimeHours: 0, completedQuantity: 24 },
  { offset: -7, operation: "半精车削", regularHours: 8, overtimeHours: 1, completedQuantity: 30 },
  { offset: -9, operation: "外圆磨削", regularHours: 8, overtimeHours: 0, completedQuantity: 22 },
  { offset: -12, operation: "键槽铣削", regularHours: 8, overtimeHours: 1.5, completedQuantity: 18 },
  { offset: -18, operation: "粗加工", regularHours: 7, overtimeHours: 0, completedQuantity: 26 },
];

const today = localDateKey();
const weekStart = startOfWeek(today);

const records = hourPlan.map((item, index) => {
  const date = localDateKey(item.offset);
  const startedAt = `${date}T08:00:00+08:00`;
  const durationHours = round1(item.regularHours + item.overtimeHours);
  return {
    id: `mock-hours-${index + 1}`,
    workerId: worker.id,
    workerName: worker.name,
    assignmentId: `mock-assignment-hours-${index + 1}`,
    orderNo: `MOCK-HOURS-${date.replaceAll("-", "")}-${String(index + 1).padStart(2, "0")}`,
    productCode: `CP-MOCK-${String(index + 1).padStart(3, "0")}`,
    productName: "统计测试产品",
    partCode: "PART-MOCK-001",
    partName: "统计测试部件",
    operationCode: `OP-${String((index + 1) * 10).padStart(3, "0")}`,
    operationName: item.operation,
    date,
    startedAt,
    completedAt: `${date}T${durationHours >= 9 ? "18" : "17"}:00:00+08:00`,
    durationHours,
    regularHours: item.regularHours,
    overtimeHours: item.overtimeHours,
    completedQuantity: item.completedQuantity,
    status: "completed",
  };
});

const expected = {
  day: summarize(records.filter((record) => record.date === today), "day"),
  week: summarize(records.filter((record) => new Date(`${record.date}T00:00:00+08:00`) >= weekStart), "week"),
  month: summarize(records.filter((record) => sameMonth(record.date, today)), "month"),
};

function summarize(items, period) {
  const totalHours = round1(items.reduce((sum, item) => sum + item.durationHours, 0));
  const regularHours = round1(items.reduce((sum, item) => sum + item.regularHours, 0));
  const overtimeHours = round1(items.reduce((sum, item) => sum + item.overtimeHours, 0));
  return {
    period,
    totalHours,
    regularHours,
    overtimeHours,
    completedOperations: items.length,
    attendanceDays: new Set(items.map((item) => item.date)).size,
  };
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `auth_token=${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const message = typeof data === "object" && data?.message ? data.message : text;
    throw new Error(`HTTP ${response.status}${message ? `: ${message}` : ""}`);
  }
  return data;
}

function closeEnough(actual, expectedValue, label) {
  const difference = Math.abs(Number(actual) - expectedValue);
  if (difference > 0.11) {
    throw new Error(`${label} expected ${expectedValue}, got ${actual}`);
  }
}

async function assertStats(period) {
  const data = await request("GET", `/statistics/me?period=${period}`);
  const target = expected[period];
  closeEnough(data.totalHours, target.totalHours, `${period}.totalHours`);
  closeEnough(data.regularHours, target.regularHours, `${period}.regularHours`);
  closeEnough(data.overtimeHours, target.overtimeHours, `${period}.overtimeHours`);
  closeEnough(data.completedOperations, target.completedOperations, `${period}.completedOperations`);
  closeEnough(data.attendanceDays, target.attendanceDays, `${period}.attendanceDays`);
  console.log(`[PASS] ${period}: ${data.totalHours}h total, ${data.overtimeHours}h overtime`);
}

const payload = {
  resetStatistics: true,
  worker,
  records,
};

console.log(`Seeding statistics at ${baseUrl}${seedPath}`);
console.log(`Records: ${records.length}`);

try {
  await request("POST", seedPath, payload);
} catch (error) {
  console.error(`[FAIL] seed endpoint is not ready: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("Add a dev-only backend route that accepts this shape:");
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

await assertStats("day");
await assertStats("week");
await assertStats("month");
