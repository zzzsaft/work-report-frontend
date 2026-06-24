import { expect, test, type Page } from "@playwright/test";

async function completeCurrentOperation(page: Page) {
  await page.getByRole("button", { name: "结束并拍照" }).click();
  await expect(page.getByRole("dialog", { name: "完成报工" })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认完成报工" })).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "finish.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByLabel("本次完成数量").fill("36");
  await page.getByRole("button", { name: "确认完成报工" }).click();
}

test.describe.skip("mobile reporting (v2 reserved)", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile project only");

  test.beforeEach(async ({ page }) => {
    await page.goto("/work/current");
    await page.evaluate(() => localStorage.removeItem("work-report-mock-db-v2"));
    await page.evaluate(() => localStorage.removeItem("work-report-mock-db-v3"));
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

  test("switches operations after pausing", async ({ page }) => {
    await page.getByRole("button", { name: "暂停作业" }).click();
    await page.getByRole("button", { name: "确认暂停" }).click();
    await expect(page.getByRole("button", { name: "切换工序" })).toBeVisible();
    await page.getByRole("button", { name: "切换工序" }).click();
    await page.getByRole("dialog", { name: "切换工序" }).getByRole("button", { name: /钻孔 · 攻丝/ }).click();
    await expect(page.getByText("钻孔 · 攻丝", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "开始作业" })).toBeVisible();
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
      const db = JSON.parse(localStorage.getItem("work-report-mock-db-v3") || "{}");
      db.assignments = db.assignments.map((item: { id: string; status: string }) => item.id === "assignment-004" ? { ...item, status: "completed" } : item);
      localStorage.setItem("work-report-mock-db-v3", JSON.stringify(db));
    });
    await page.reload();
    await completeCurrentOperation(page);
    await expect(page.getByText("钻孔 · 攻丝", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "开始作业" })).toBeVisible();
  });

  test("shows the day-complete state when no operation remains", async ({ page }) => {
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem("work-report-mock-db-v3") || "{}");
      db.assignments = db.assignments.map((item: { id: string; status: string }) => ["assignment-002", "assignment-004"].includes(item.id) ? { ...item, status: "completed" } : item);
      localStorage.setItem("work-report-mock-db-v3", JSON.stringify(db));
    });
    await page.reload();
    await completeCurrentOperation(page);
    await expect(page.getByRole("heading", { name: "今日工序已全部完成" })).toBeVisible();
    await expect(page.getByText("辛苦了！今天安排的报工任务均已完成。")).toBeVisible();
    await page.screenshot({ path: "qa-artifacts/day-completed.png" });
  });
});

test.describe("mobile claim operations", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile project only");

  test.beforeEach(async ({ page }) => {
    await page.goto("/work/claim");
    await page.evaluate(() => localStorage.removeItem("work-report-mock-db-v3"));
    await page.reload();
  });

  test("claims an operation and allows removing it before start", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "最近可以领取的工序" })).toBeVisible();
    await expect(page.getByText("法兰攻丝")).toBeVisible();
    await expect(page.getByRole("button", { name: "人数已满" })).toBeDisabled();
    await page.getByRole("button", { name: "可领取" }).click();
    await expect(page.getByText("法兰攻丝")).not.toBeVisible();
    await page.getByRole("button", { name: "全部" }).click();
    await page.getByRole("button", { name: "搜索" }).click();
    await page.getByRole("button", { name: /CP-JSJ-240623-07/ }).click();
    await page.getByRole("button", { name: /PART-COVER-002/ }).click();
    await page.getByRole("button", { name: "领取工序" }).click();
    await expect(page.getByText("已领取工序")).toBeVisible();
    await expect(page.getByRole("button", { name: "去开始" })).not.toBeVisible();
    await page.getByRole("button", { name: "查看已领取" }).click();
    const claimedList = page.getByLabel("我的已领取工序");
    await expect(claimedList.getByText("端盖钻孔")).toBeVisible();
    await claimedList.getByRole("button", { name: "删除领取" }).click();
    await expect(claimedList.getByText("端盖钻孔")).not.toBeVisible();
  });

  test("redirects v2 mobile reporting routes to claim page", async ({ page }) => {
    for (const path of ["/work/current", "/work/operations", "/work/stats"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/work\/claim$/);
      await expect(page.getByRole("heading", { name: "领取工序" })).toBeVisible();
      await expect(page.getByRole("button", { name: "开始作业" })).not.toBeVisible();
      await expect(page.getByRole("button", { name: "结束并拍照" })).not.toBeVisible();
    }
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

  test("imports leader operations and assigns work", async ({ page }) => {
    await page.goto("/admin/import");
    await expect(page.getByRole("heading", { name: "小组长工序导入" })).toBeVisible();
    await expect(page.getByText("校验通过")).toBeVisible();
    await page.getByRole("button", { name: "确认导入" }).click();
    await expect(page.getByText(/已导入/)).toBeVisible();

    await page.getByRole("link", { name: "人员分配" }).click();
    await page.getByRole("button", { name: "搜索" }).click();
    await page.getByRole("button", { name: /CP-JSJ-240623-07/ }).first().click();
    await page.getByRole("button", { name: /PART-CASE-001/ }).first().click();
    await page.getByRole("button", { name: "分配给人员" }).first().click();
    await expect(page.getByText("已分配给 张师傅")).toBeVisible();
  });
});

test.describe.skip("work statistics (v2 reserved)", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile project only");

  test("distinguishes overtime from regular hours", async ({ page }) => {
    await page.goto("/work/stats");
    await expect(page.getByLabel("工时图例")).toContainText("正常");
    await expect(page.getByLabel("工时图例")).toContainText("加班");
    await expect(page.getByLabel("周二正常工时 8 小时，加班 0.5 小时")).toBeVisible();
    await expect(page.getByText("加班 0.5h")).toBeVisible();
  });

  test("hides daily trend for today and shows weekly trend for month", async ({ page }) => {
    await page.goto("/work/stats");
    await page.getByRole("button", { name: "今日" }).click();
    await expect(page.getByText("今日统计只显示汇总")).toBeVisible();
    await expect(page.getByRole("heading", { name: "每日工时" })).not.toBeVisible();
    await page.getByRole("button", { name: "本月" }).click();
    await expect(page.getByRole("heading", { name: "每周工时" })).toBeVisible();
    await expect(page.getByText("最近2个月")).toBeVisible();
    await expect(page.getByLabel("5月第1周正常工时 37 小时，加班 1 小时")).toBeVisible();
  });
});
