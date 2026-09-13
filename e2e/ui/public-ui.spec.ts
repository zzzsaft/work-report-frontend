import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // No UI verification request is allowed to reach a production service.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (!url.pathname.startsWith("/__test_api")) return route.continue();
    const body = url.pathname.includes("departments/simplelist") ? { departmentId: [] }
      : url.pathname.includes("join-qrcode") ? { join_qrcode: "" } : [];
    return route.fulfill({ json: body });
  });
});

test("narrow admin toolbar keeps complete labels and separated touch targets", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "viewport audit runs once");
  for (const width of [320, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/admin/people");
    await expect(page.getByRole("heading", { name: "人员统计" })).toBeVisible();
    await expect(page.getByText("正在读取生产数据...", { exact: true })).toHaveCount(0);
    const header = page.getByLabel("管理工具栏");
    const targets = header.locator("button, a");
    await expect(targets).toHaveCount(4);
    const boxes = await targets.evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
    }));
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].height).toBeGreaterThanOrEqual(44);
      expect(boxes[i].width).toBeGreaterThanOrEqual(44);
      expect(boxes[i].left).toBeGreaterThanOrEqual(12);
      expect(boxes[i].right).toBeLessThanOrEqual(width - 12);
      expect(boxes[i].scrollWidth).toBeLessThanOrEqual(boxes[i].clientWidth);
      if (i) expect(boxes[i].left - boxes[i - 1].right).toBeGreaterThanOrEqual(6);
    }
    for (const name of ["进入薪福通", "打开移动端"]) {
      const lines = await header.getByRole("link", { name }).evaluate((node) => {
        const range = document.createRange(); range.selectNodeContents(node);
        return range.getClientRects().length;
      });
      expect(lines).toBe(1);
    }
    await page.screenshot({ path: info.outputPath(`people-${width}.png`), fullPage: true, scale: "css" });
  }
});

test("crowding audit checks form clipping, overlap and touch sizes across layouts", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "viewport audit runs once");
  test.setTimeout(120_000);
  const problems: string[] = [];
  for (const width of [320, 390, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/admin/reports", "/admin/people", "/admin/accounts", "/admin/assignments", "/admin/wecom", "/admin/import", "/work/claim", "/work/stats"]) {
      await page.goto(path);
      await expect(page.locator(".ui-page-header")).toBeVisible();
      await expect(page.getByText("正在读取生产数据...", { exact: true })).toHaveCount(0);
      await expect(page.getByText("正在加载报工数据...", { exact: true })).toHaveCount(0);
      const issues = await page.evaluate(() => {
        const results: string[] = [];
        const controls = Array.from(document.querySelectorAll<HTMLElement>("button, a, input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea")).filter((node) => {
          if (node.closest(".work-report-table, .handsontable")) return false;
          const r = node.getBoundingClientRect(), style = getComputedStyle(node);
          return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && style.visibility !== "hidden" && style.display !== "none";
        });
        const label = (node: HTMLElement) => node.getAttribute("aria-label") || node.getAttribute("placeholder") || node.textContent?.trim().slice(0, 30) || node.tagName;
        for (let i = 0; i < controls.length; i++) {
          const node = controls[i], r = node.getBoundingClientRect();
          if (r.left < -1 || r.right > innerWidth + 1) results.push(`clipped: ${label(node)}`);
          if (r.height < 43.5) results.push(`touch height ${Math.round(r.height)}: ${label(node)}`);
          for (let j = i + 1; j < controls.length; j++) {
            const other = controls[j];
            if (node.contains(other) || other.contains(node)) continue;
            // The arrow is intentionally positioned inside the public input surface.
            if (node.closest(".ui-date-input, .ui-input-adorned, .ui-combobox-control")?.contains(other)) continue;
            const b = other.getBoundingClientRect();
            if (Math.min(r.right, b.right) - Math.max(r.left, b.left) > 2 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 2) results.push(`overlap: ${label(node)} / ${label(other)}`);
          }
        }
        if (document.documentElement.scrollWidth > innerWidth + 1) results.push("page overflow");
        return results;
      });
      problems.push(...issues.map((issue) => `${width} ${path}: ${issue}`));
      if ([320, 412, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`${path.split("/").pop()}-${width}.png`), fullPage: true, scale: "css" });
    }
  }
  expect(problems).toEqual([]);
});

test("all pages render with the existing theme and no runtime errors", async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const routes = [
    ["/work/claim", "领取工序"], ["/work/operations", "工序清单"], ["/work/stats", "我的统计"],
    ["/admin/dashboard", "生产总览"], ["/admin/orders", "工单管理"],
    ["/admin/assignments", "人员工序映射"], ["/admin/reports", "报工记录"],
    ["/admin/people", "人员统计"], ["/admin/permissions", "权限设置"],
    ["/admin/accounts", "账号管理"], ["/admin/wecom", "企业微信管理"],
  ];
  for (const [path, title] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator(".ui-page-header")).toBeVisible();
    await expect(page.getByText("正在读取生产数据...", { exact: true })).toHaveCount(0);
    await expect(page.getByText("正在加载报工数据...", { exact: true })).toHaveCount(0);
    await expect(page.getByText("正在读取...", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ui-primary").trim())).toBe("#0b4db7");
    if (["/work/claim", "/admin/reports", "/admin/people"].includes(path)) {
      await page.screenshot({ path: info.outputPath(`${path.split("/").pop()}.png`), fullPage: true });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("claim dates and repeated-claim confirmation preserve the submitted operation", async ({ page }, info) => {
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/work/claim");
  await expect(page.getByRole("heading", { name: "领取工序", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("work-report-mock-db-v3") !== null)).toBe(true);
  await expect(page.getByText("正在读取...", { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const key = "work-report-mock-db-v3";
    const db = JSON.parse(localStorage.getItem(key)!);
    const previous = { ...db.assignments[0], id: "ui-old", orderNo: "UI-ORDER", productCode: "UI-PRODUCT", partCode: "UI-PART", partNo: "0", operationNo: "10", operationCode: "UI-OP", claimedAt: new Date(Date.now() - 3600_000).toISOString(), status: "assigned" };
    db.assignments = [previous];
    db.claimProducts = [{ id: "ui-product", orderNo: "UI-ORDER", productCode: "UI-PRODUCT", productName: "验收产品", remainingQuantity: 10 }];
    db.claimParts = [{ id: "ui-part", productId: "ui-product", partNo: "0", partCode: "UI-PART", partName: "验收部件", operationCount: 1, remainingQuantity: 10 }];
    db.claimOperations = [{ id: "ui-op", productId: "ui-product", partId: "ui-part", orderNo: "UI-ORDER", productCode: "UI-PRODUCT", productName: "验收产品", partNo: "0", partCode: "UI-PART", partName: "验收部件", operationNo: "10", operationCode: "UI-OP", operationName: "验收工序", operationNote: "测试数据", plannedQuantity: 10, estimatedHours: 1, claimedWorkers: 1, status: "available" }];
    localStorage.setItem(key, JSON.stringify(db));
  });
  await page.reload();
  await page.getByPlaceholder("输入产品编号搜索").fill("UI-PRODUCT");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.getByRole("button", { name: "领取工序", exact: true }).click();
  await expect(page.getByRole("heading", { name: "工序确认" })).toBeVisible();
  await expect(page.getByRole("button", { name: "确认领取" })).toBeEnabled();
  await expect(page.locator(".ui-date-input")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const calendarTrigger = page.getByRole("button", { name: "打开日期选择器" }).first();
  await calendarTrigger.click();
  await expect(page.getByRole("dialog", { name: "选择日期" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "选择日期" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("claim-dates.png"), fullPage: true, scale: "css" });
  await page.getByRole("button", { name: "确认领取" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "请确认" });
  await expect(confirmation).toContainText("之前已领取过该工序");
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("heading", { name: "工序确认" })).toBeVisible();
  await page.getByRole("button", { name: "确认领取" }).click();
  await confirmation.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByRole("heading", { name: "工序确认" })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("work-report-mock-db-v3")!).assignments.length)).toBe(2);
});

test("public modal saves a team, traps focus, returns focus and confirms deletion", async ({ page }, info) => {
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/admin/assignments");
  const create = page.getByRole("button", { name: "新建班组" });
  await create.click();
  const modal = page.getByRole("dialog", { name: "新建班组" });
  await expect(modal).toBeVisible();
  await modal.getByLabel("班组名称").fill("公共组件验收班组");
  await page.keyboard.press("Shift+Tab");
  expect(await modal.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await modal.evaluate(async (node) => {
    await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
  });
  const footerBoxes = await modal.locator(".ui-modal-footer button").evaluateAll((nodes) => nodes.map((node) => {
    const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, height: r.height };
  }));
  expect(footerBoxes[1].left - footerBoxes[0].right).toBeGreaterThanOrEqual(8);
  expect(footerBoxes.every((box) => box.height >= 44), JSON.stringify(footerBoxes)).toBe(true);
  const panelBox = await modal.locator(".ui-modal").boundingBox();
  const inputBox = await modal.getByLabel("班组名称").boundingBox();
  expect(inputBox!.x - panelBox!.x).toBeGreaterThanOrEqual(16);
  expect(panelBox!.x + panelBox!.width - footerBoxes[1].right).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: info.outputPath("team-dialog.png"), scale: "css" });
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(create).toBeFocused();
  await create.click();
  await modal.getByLabel("班组名称").fill("公共组件验收班组");
  await modal.getByRole("button", { name: "保存", exact: true }).click();
  await expect(modal).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "公共组件验收班组" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "删除", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "请确认" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "取消", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await confirm.getByRole("button", { name: "确认", exact: true }).click();
  await expect(row).toHaveCount(0);
});

test("report table keeps server filters, edit actions and pagination", async ({ page }, info) => {
  await page.goto("/admin/reports");
  const table = page.locator(".work-report-table");
  await expect(table.getByRole("columnheader", { name: "工单", exact: true })).toBeVisible();
  await expect(table.getByRole("row")).not.toHaveCount(1);
  await page.getByPlaceholder("工单编号", { exact: true }).fill("UI-NO-MATCH");
  await expect(table).toContainText("没有匹配的报工记录");
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await table.getByRole("button", { name: "修改", exact: true }).first().click();
  await expect(table.locator(".ui-input")).toBeVisible();
  await table.locator(".ui-input").fill("2.5");
  await table.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByText("修改成功", { exact: true })).toBeVisible();
  await expect(page.locator(".ui-pagination")).toBeVisible();
  await page.screenshot({ path: info.outputPath("reports-loaded.png"), fullPage: true });
});

test("mobile filters and statistics use keyboard-accessible public controls", async ({ page }, info) => {
  await page.goto("/work/claim");
  await page.getByRole("tab", { name: "查看最近" }).click();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", /recent/);
  await page.getByRole("radio", { name: "当日", exact: true }).press("Space");
  await expect(page.getByRole("radio", { name: "当日", exact: true })).toBeChecked();
  await page.goto("/work/stats");
  await page.getByRole("radio", { name: "今日", exact: true }).press("Space");
  await expect(page.getByText("今日统计只显示汇总")).toBeVisible();
  await page.getByRole("radio", { name: "本月", exact: true }).press("Space");
  await expect(page.getByText("本月按周汇总")).toBeVisible();
  await page.screenshot({ path: info.outputPath("statistics.png"), fullPage: true });
});

