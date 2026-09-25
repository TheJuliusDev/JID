/**
 * Cloudinary image uploads (unsigned, browser-direct).
 *
 * Images are uploaded straight to Cloudinary and only the resulting secure HTTPS
 * URL is stored in Supabase — never base64, never a fake/placeholder URL. Uploads
 * report real progress and surface real errors so the caller can retry.
 *
 * Requires EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 * (an *unsigned* upload preset). The API secret is never used in the client.
 */
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, hasCloudinaryConfig } from '../config/env';

export interface UploadResult {
  url: string;
  publicId?: string;
}

export interface UploadOptions {
  folder?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return 'Please choose an image file (JPG, PNG, WEBP).';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'Image is larger than 10MB. Please choose a smaller file.';
  }
  return null;
}

/** Upload a single image to Cloudinary with real progress. Throws on failure. */
export function uploadImage(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  if (!hasCloudinaryConfig) {
    return Promise.reject(
      new Error('Image uploads are not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.')
    );
  }

  const validationError = validateImageFile(file);
  if (validationError) return Promise.reject(new Error(validationError));

  return new Promise<UploadResult>((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', options.folder || 'jid');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.secure_url) {
            reject(new Error('Upload did not return an image URL.'));
            return;
          }
          options.onProgress?.(100);
          resolve({ url: data.secure_url, publicId: data.public_id });
        } catch {
          reject(new Error('Could not read the upload response.'));
        }
      } else {
        let message = `Upload failed (${xhr.status}).`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error?.message) message = data.error.message;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
      } else {
        options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }
    }

    xhr.send(formData);
  });
}

/** Upload several images, reporting per-file progress. Throws on the first failure. */
export async function uploadImages(
  files: File[],
  onFileProgress?: (index: number, percent: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < files.length; i += 1) {
    // Sequential keeps progress legible and avoids hammering the network on mobile.
    const result = await uploadImage(files[i], { onProgress: (p) => onFileProgress?.(i, p) });
    results.push(result);
  }
  return results;
}

export { hasCloudinaryConfig };
