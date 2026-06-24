const DEFAULT_BASE_URL = "http://localhost:2020";
const DEFAULT_TOKEN = "mock-token";

const baseUrl = (process.env.BASE_URL || process.env.VITE_WORK_REPORT_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const token = process.env.TOKEN || process.env.WORK_REPORT_TOKEN || DEFAULT_TOKEN;

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` - ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isString(value) {
  return typeof value === "string";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
}

function assertAssignment(value, label = "assignment") {
  assert(value && typeof value === "object", `${label} must be an object`);
  [
    "id",
    "workOrderId",
    "orderNo",
    "productCode",
    "productName",
    "partCode",
    "operationCode",
    "operationName",
    "operationNote",
    "plannedStart",
    "plannedEnd",
    "source",
    "status",
  ].forEach((field) => assert(isString(value[field]), `${label}.${field} must be a string`));
  assert(isNumber(value.plannedQuantity), `${label}.plannedQuantity must be a number`);
  assert(typeof value.canWorkerRemove === "boolean", `${label}.canWorkerRemove must be a boolean`);
  assertArray(value.collaborators, `${label}.collaborators`);
}

function assertProduct(value, label = "product") {
  assert(value && typeof value === "object", `${label} must be an object`);
  ["id", "orderNo", "productCode", "productName"].forEach((field) =>
    assert(isString(value[field]), `${label}.${field} must be a string`),
  );
  assert(isNumber(value.remainingQuantity), `${label}.remainingQuantity must be a number`);
}

function assertPart(value, label = "part") {
  assert(value && typeof value === "object", `${label} must be an object`);
  ["id", "productId", "partCode", "partName"].forEach((field) =>
    assert(isString(value[field]), `${label}.${field} must be a string`),
  );
  assert(isNumber(value.operationCount), `${label}.operationCount must be a number`);
  assert(isNumber(value.remainingQuantity), `${label}.remainingQuantity must be a number`);
}

function assertOperation(value, label = "operation") {
  assert(value && typeof value === "object", `${label} must be an object`);
  [
    "id",
    "productId",
    "partId",
    "orderNo",
    "productCode",
    "productName",
    "partCode",
    "partName",
    "operationCode",
    "operationName",
    "operationNote",
    "status",
  ].forEach((field) => assert(isString(value[field]), `${label}.${field} must be a string`));
  assert(isNumber(value.plannedQuantity), `${label}.plannedQuantity must be a number`);
  assert(isNumber(value.estimatedHours), `${label}.estimatedHours must be a number`);
  assert(isNumber(value.claimedWorkers), `${label}.claimedWorkers must be a number`);
}

function assertStatistics(value, expectedPeriod) {
  assert(value && typeof value === "object", "statistics must be an object");
  assert(value.period === expectedPeriod, `statistics.period must be ${expectedPeriod}`);
  ["totalHours", "regularHours", "overtimeHours", "completedOperations", "attendanceDays"].forEach((field) =>
    assert(isNumber(value[field]), `statistics.${field} must be a number`),
  );
  assertArray(value.trend, "statistics.trend");
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
      throw new Error(`HTTP ${response.status}, response is not JSON: ${text.slice(0, 160)}`);
    }
  }
  if (!response.ok) {
    const message = data?.message ? `: ${data.message}` : text ? `: ${text.slice(0, 160)}` : "";
    throw new Error(`HTTP ${response.status}${message}`);
  }
  return { data, status: response.status };
}

async function runCheck(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail);
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

let products = [];
let parts = [];
let operations = [];
let claimedAssignmentId = "";

console.log(`Testing v1 work-report API at ${baseUrl}`);
console.log(`Using token source: ${token === DEFAULT_TOKEN ? "default mock token" : "environment token"}`);

await runCheck("GET /health", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert(response.ok, `HTTP ${response.status}`);
  return `HTTP ${response.status}`;
});

await runCheck("GET /assignments", async () => {
  const { data } = await request("GET", "/assignments");
  assertArray(data, "assignments");
  data.forEach((item, index) => assertAssignment(item, `assignments[${index}]`));
  return `${data.length} assignments`;
});

await runCheck("GET /claim/products", async () => {
  const { data } = await request("GET", "/claim/products?keyword=");
  assertArray(data, "products");
  data.forEach((item, index) => assertProduct(item, `products[${index}]`));
  products = data;
  return `${data.length} products`;
});

await runCheck("GET /claim/products?keyword=mock", async () => {
  const { data } = await request("GET", "/claim/products?keyword=mock");
  assertArray(data, "products");
  data.forEach((item, index) => assertProduct(item, `products[${index}]`));
  return `${data.length} products`;
});

await runCheck("GET /claim/products/:productId/parts", async () => {
  if (!products[0]) return "skipped: no product returned";
  const { data } = await request("GET", `/claim/products/${encodeURIComponent(products[0].id)}/parts`);
  assertArray(data, "parts");
  data.forEach((item, index) => assertPart(item, `parts[${index}]`));
  parts = data;
  return `${data.length} parts`;
});

await runCheck("GET /claim/parts/:partId/operations", async () => {
  if (!parts[0]) return "skipped: no part returned";
  const { data } = await request("GET", `/claim/parts/${encodeURIComponent(parts[0].id)}/operations`);
  assertArray(data, "operations");
  data.forEach((item, index) => assertOperation(item, `operations[${index}]`));
  operations = data;
  return `${data.length} operations`;
});

await runCheck("POST /claim/operations/:operationId/claim", async () => {
  const operation = operations.find((item) => item.status === "available");
  if (!operation) return "skipped: no available operation returned";
  const { data } = await request("POST", `/claim/operations/${encodeURIComponent(operation.id)}/claim`);
  assertAssignment(data, "claimedAssignment");
  claimedAssignmentId = data.id;
  return `claimed ${data.id}`;
});

await runCheck("DELETE /assignments/:assignmentId/claim", async () => {
  if (!claimedAssignmentId) return "skipped: no assignment was claimed";
  const { status } = await request("DELETE", `/assignments/${encodeURIComponent(claimedAssignmentId)}/claim`);
  return `HTTP ${status}`;
});

for (const period of ["day", "week", "month"]) {
  await runCheck(`GET /statistics/me?period=${period}`, async () => {
    const { data } = await request("GET", `/statistics/me?period=${period}`);
    assertStatistics(data, period);
    return `${data.totalHours}h`;
  });
}

const failed = results.filter((item) => !item.ok);
console.log("");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  process.exitCode = 1;
}
