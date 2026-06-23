import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("uses backend response messages when present", () => {
    expect(getErrorMessage({ response: { data: { message: "图片太大" } } })).toBe("图片太大");
    expect(getErrorMessage({ response: { data: { error: "上传失败" } } })).toBe("上传失败");
  });

  it("falls back to Error messages and default text", () => {
    expect(getErrorMessage(new Error("网络异常"))).toBe("网络异常");
    expect(getErrorMessage(null, "请稍后再试")).toBe("请稍后再试");
  });
});
