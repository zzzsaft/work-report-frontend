const DEFAULT_BASE_URL = "http://localhost:2020";
const DEFAULT_TOKEN = "mock-token";

const baseUrl = (process.env.BASE_URL || process.env.VITE_WORK_REPORT_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const token = process.env.TOKEN || process.env.WORK_REPORT_TOKEN || DEFAULT_TOKEN;

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `auth_token=${token}`,
    "Content-Type": "application/json",
  };
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(),
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
    throw new Error(`${method} ${path} failed: HTTP ${response.status}${message ? `: ${message}` : ""}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function closeEnough(actual, expected, label) {
  const difference = Math.abs(Number(actual) - expected);
  assert(difference <= 0.11, `${label} expected delta ${expected}, got ${actual}`);
}

async function getStatistics() {
  const [day, week, month] = await Promise.all(["day", "week", "month"].map((period) => request("GET", `/statistics/me?period=${period}`)));
  return { day, week, month };
}

async function findAvailableOperation() {
  const products = await request("GET", "/claim/products?keyword=");
  assert(Array.isArray(products) && products.length > 0, "no claimable products returned");
  for (const product of products) {
    const parts = await request("GET", `/claim/products/${encodeURIComponent(product.id)}/parts`);
    for (const part of parts) {
      const operations = await request("GET", `/claim/parts/${encodeURIComponent(part.id)}/operations`);
      const operation = operations.find((item) => item.status === "available");
      if (operation) return operation;
    }
  }
  throw new Error("no available operation returned");
}

function assertClaimDelta(before, after, hours, label) {
  closeEnough(after.totalHours - before.totalHours, hours, `${label}.totalHours`);
  closeEnough(after.regularHours - before.regularHours, hours, `${label}.regularHours`);
  closeEnough(after.overtimeHours - before.overtimeHours, 0, `${label}.overtimeHours`);
  closeEnough(after.completedOperations - before.completedOperations, 1, `${label}.completedOperations`);
  assert(after.attendanceDays >= before.attendanceDays, `${label}.attendanceDays should not decrease`);
}

let claimedAssignmentId = "";

console.log(`Testing claimed-operation statistics at ${baseUrl}`);
console.log("Run this check without another claim/cleanup test in parallel, because it intentionally claims one operation.");

try {
  const before = await getStatistics();
  const operation = await findAvailableOperation();
  assert(typeof operation.estimatedHours === "number" && operation.estimatedHours > 0, "available operation must include positive estimatedHours");

  const assignment = await request("POST", `/claim/operations/${encodeURIComponent(operation.id)}/claim`);
  claimedAssignmentId = assignment.id;
  const hours = assignment.estimatedHours ?? operation.estimatedHours;

  const after = await getStatistics();
  assertClaimDelta(before.day, after.day, hours, "day");
  assertClaimDelta(before.week, after.week, hours, "week");
  assertClaimDelta(before.month, after.month, hours, "month");

  console.log(`[PASS] claiming ${assignment.operationName} added ${hours}h to day/week/month statistics`);
} finally {
  if (claimedAssignmentId) {
    await request("DELETE", `/assignments/${encodeURIComponent(claimedAssignmentId)}/claim`);
    console.log(`[CLEANUP] removed claimed assignment ${claimedAssignmentId}`);
  }
}
