export const MAX_COMPLETION_PHOTOS = 5;
export const MAX_COMPLETION_PHOTO_BYTES = 10 * 1024 * 1024;

export interface ImagePreview {
  file: File;
  previewUrl: string;
}

export interface ImageSelectionResult {
  accepted: File[];
  error: string | null;
}

export function selectImageFiles(
  files: Iterable<File>,
  existingCount: number,
): ImageSelectionResult {
  const remaining = Math.max(0, MAX_COMPLETION_PHOTOS - existingCount);
  const candidates = Array.from(files);
  const images = candidates.filter((file) => file.type.startsWith("image/"));
  const accepted = images
    .filter((file) => file.size <= MAX_COMPLETION_PHOTO_BYTES)
    .slice(0, remaining);

  if (candidates.some((file) => !file.type.startsWith("image/"))) {
    return { accepted, error: "只能选择图片文件" };
  }
  if (images.some((file) => file.size > MAX_COMPLETION_PHOTO_BYTES)) {
    return { accepted, error: "单张图片不能超过 10 MB" };
  }
  if (candidates.length > remaining) {
    return { accepted, error: `最多只能添加 ${MAX_COMPLETION_PHOTOS} 张图片` };
  }
  return { accepted, error: null };
}

export function createImagePreviews(files: File[]): ImagePreview[] {
  return files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
}

export function revokeImagePreviews(previews: ImagePreview[]) {
  previews.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}
