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

export interface CompletionPhotoPayload {
  name: string;
  url: string;
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
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        reject(new Error("图片读取失败，请重新选择照片"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败，请重新选择照片"));
    reader.onabort = () => reject(new Error("图片读取已取消，请重新选择照片"));
    reader.readAsDataURL(file);
  });
}

export async function filesToCompletionPhotos(files: File[]): Promise<CompletionPhotoPayload[]> {
  const photos: CompletionPhotoPayload[] = [];
  for (const file of files) {
    try {
      photos.push({ name: file.name, url: await fileToDataUrl(file) });
    } catch {
      throw new Error(`图片“${file.name || "未命名"}”读取失败，请删除后重新选择`);
    }
  }
  return photos;
}
