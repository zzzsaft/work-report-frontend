import { expect, test, type Page } from "@playwright/test";

async function completeCurrentOperation(page: Page) {
  await page.getByRole("button", { name: "结束并拍照" }).click();
  await expect(page.getByRole("button", { name: "确认完成报工" })).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "finish.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByLabel("本次完成数量").fill("36");
  await page.getByRole("button", { name: "确认完成报工" }).click();
}

test.describe("mobile reporting", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile project only");

  test.beforeEach(async ({ page }) => {
    await page.goto("/work/current");
    await page.evaluate(() => localStorage.removeItem("work-report-mock-db-v2"));
    await page.reload();
    await expect(page.getByText("CP-JSJ-240623-07")).toBeVisible();
  });

  test("shows process note and supports pause and resume", async ({ page }) => {
    await page.getByRole("button", { name: "查看工序备注" }).click();
    await expect(page.getByRole("dialog", { name: "工序备注" })).toContainText("首件完成后检查孔距");
    await page.getByRole("button", { name: "我知道了" }).click();

    await page.getByRole("button", { name: "暂停作业" }).click();
    await page.getByRole("button", { name: "确认暂停" }).click();
    await expect(page.getByText("已暂停", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "恢复作业" }).click();
    await expect(page.getByText("进行中", { exact: true })).toBeVisible();
  });

  test("asks the worker to choose when multiple operations remain", async ({ page }) => {
    await completeCurrentOperation(page);
    const dialog = page.getByRole("dialog", { name: "选择下一工序" });
    await expect(dialog).toContainText("今日还有 2 道未完成工序");
    await page.screenshot({ path: "qa-artifacts/next-operation-choice.png" });
    await dialog.getByRole("button", { name: /钻孔 · 攻丝/ }).click();
    await expect(page.getByText("钻孔 · 攻丝", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "开始作业" })).toBeVisible();
  });

  test("moves directly to the sole remaining operation", async ({ page }) => {
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("work-report-mock-db-v2") || "{}");
      db.assignments = db.assignments.map((item: { id: string; status: string }) => item.id === "assignment-004" ? { ...item, status: "completed" } : item);
      localStorage.setItem("work-report-mock-db-v2", JSON.stringify(db));
    });
    await page.reload();
    await completeCurrentOperation(page);
    await expect(page.getByText("钻孔 · 攻丝", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "开始作业" })).toBeVisible();
  });

  test("shows the day-complete state when no operation remains", async ({ page }) => {
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("work-report-mock-db-v2") || "{}");
      db.assignments = db.assignments.map((item: { id: string; status: string }) => ["assignment-002", "assignment-004"].includes(item.id) ? { ...item, status: "completed" } : item);
      localStorage.setItem("work-report-mock-db-v2", JSON.stringify(db));
    });
    await page.reload();
    await completeCurrentOperation(page);
    await expect(page.getByRole("heading", { name: "今日工序已全部完成" })).toBeVisible();
    await expect(page.getByText("辛苦了！今天安排的报工任务均已完成。")).toBeVisible();
    await page.screenshot({ path: "qa-artifacts/day-completed.png" });
  });
});

test.describe("admin console", () => {
  test.skip(({ isMobile }) => isMobile, "desktop project only");

  test("loads dashboard and navigates operational pages", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("heading", { name: "生产总览" })).toBeVisible();
    await expect(page.getByText("146.5")).toBeVisible();
    await page.getByRole("link", { name: "工单与工序" }).click();
    await expect(page.getByText("WO-20260623-018")).toBeVisible();
    await page.getByRole("link", { name: "异常审核" }).click();
    await expect(page.getByText("工序用时超过计划")).toBeVisible();
  });
});

test.describe("work statistics", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile project only");

  test("distinguishes overtime from regular hours", async ({ page }) => {
    await page.goto("/work/stats");
    await expect(page.getByLabel("工时图例")).toContainText("正常");
    await expect(page.getByLabel("工时图例")).toContainText("加班");
    await expect(page.getByLabel("周二正常工时 8 小时，加班 0.5 小时")).toBeVisible();
    await expect(page.getByText("加班 0.5h")).toBeVisible();
  });
});
