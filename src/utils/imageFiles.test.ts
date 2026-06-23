import { describe, expect, it, vi } from "vitest";
import {
  MAX_COMPLETION_PHOTO_BYTES,
  createImagePreviews,
  revokeImagePreviews,
  selectImageFiles,
} from "./imageFiles";

const image = (name: string, size = 10, type = "image/jpeg") =>
  new File([new Uint8Array(size)], name, { type });

describe("completion image files", () => {
  it("limits the total number of accepted images", () => {
    const result = selectImageFiles([image("1.jpg"), image("2.jpg")], 4);
    expect(result.accepted.map((file) => file.name)).toEqual(["1.jpg"]);
    expect(result.error).toContain("5");
  });

  it("rejects unsupported and oversized files", () => {
    expect(selectImageFiles([image("note.txt", 10, "text/plain")], 0).error).toContain("图片");
    expect(selectImageFiles([image("large.jpg", MAX_COMPLETION_PHOTO_BYTES + 1)], 0).error).toContain("10 MB");
  });

  it("releases every generated preview URL", () => {
    const previews = createImagePreviews([image("1.jpg"), image("2.jpg")]);
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    revokeImagePreviews(previews);
    expect(revoke).toHaveBeenCalledTimes(2);
    revoke.mockRestore();
  });
});
