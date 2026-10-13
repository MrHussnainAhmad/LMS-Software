export const MAX_CONTENT_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image compression failed')), 'image/webp', quality));
}

export async function prepareImageUpload(file: File, maximumBytes = MAX_CONTENT_UPLOAD_BYTES) {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  if (!IMAGE_EXTENSIONS.has(extension) || !IMAGE_MIMES.has(file.type.toLowerCase())) throw new Error('Choose a JPG, PNG, or WebP image.');

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    let quality = 0.82;
    let result: Blob | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image compression is unavailable');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      result = await canvasBlob(canvas, quality);
      if (result.size <= maximumBytes) break;
      scale *= 0.8;
      quality = Math.max(0.55, quality - 0.08);
    }
    if (!result || result.size > maximumBytes) throw new Error('Image remains larger than 5 MB after compression. Choose a smaller image.');
    return new File([result], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
