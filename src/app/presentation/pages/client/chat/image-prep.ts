/** Anh gui trong chat: gioi han chung voi storage-service (thu muc "chat-messages") va social-service. */
export const CHAT_MAX_IMAGES = 10;
export const CHAT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MAX_EDGE = 2048;
/** Anh nho hon muc nay va dung dinh dang thi gui nguyen, khong nen lai. */
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;

/**
 * Chuan bi anh truoc khi tai len: thu nho canh dai ve 2048px va nen JPEG khi anh lon hoac khong phai
 * dinh dang storage chap nhan (vd. HEIC tu iPhone ma trinh duyet van giai ma duoc). Anh chup dien thoai
 * 4-8 MB thuong con 400-900 KB, tai nhanh hon nhieu tren 4G. GIF giu nguyen de khong mat chuyen dong.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  const accepted = CHAT_IMAGE_TYPES.includes(file.type);
  if (accepted && file.size <= KEEP_AS_IS_BYTES) return file;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) {
    if (accepted) return file;
    throw new Error('Không đọc được ảnh này.');
  }
  // Nen xong ma con lon hon ban goc (anh da nen san) thi gui ban goc.
  if (accepted && blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, '') || 'anh';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Mot so trinh duyet khong nhan tuy chon; roi xuong <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
