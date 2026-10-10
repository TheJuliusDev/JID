/**
 * Cloudinary image uploads, direct from the device.
 *
 * Ported from the website's `src/services/cloudinary.ts`. JID has no upload
 * server: images are pushed straight to Cloudinary using an **unsigned**
 * upload preset, which Cloudinary allows only when the preset is explicitly
 * configured with `unsigned` signing. The API secret is never involved and
 * never shipped.
 *
 * The same byte-limiting and mime checks the website enforces are enforced
 * here, plus a client-side dimension check that the web app skips because the
 * browser can rely on `createImageBitmap`.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { env } from './env';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — Cloudinary free tier limit
export const MAX_IMAGES_PER_LISTING = 8;
export const MIN_DIMENSION = 400; // px on the short edge
export const MAX_DIMENSION = 4096;

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
}

export interface UploadProgress {
  /** 0..1 */
  progress: number;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/** The mime type we can infer from a file extension; defaults to jpeg. */
const mimeFromUri = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

/**
 * Client-side validation run before any bytes leave the device.
 *
 * Compressed aggressively by the picker, images can still land under the byte
 * limit but at too low a resolution to be useful in a listing gallery, and an
 * oversized photo produces a confusing Cloudinary 400 much later.
 */
export function validateAsset(asset: ImagePicker.ImagePickerAsset): void {
  validateImage(asset, { minDimension: MIN_DIMENSION });
}

/**
 * The same checks with a configurable floor on the short edge.
 *
 * A listing gallery needs enough resolution to be a useful advert, so it holds
 * the 400px bar. A chat attachment does not — people send screenshots of
 * receipts and room photos taken on the fly, often smaller than that — so chat
 * calls this with a much lower floor rather than rejecting legitimate sends.
 */
export function validateImage(
  asset: ImagePicker.ImagePickerAsset,
  { minDimension }: { minDimension?: number } = {},
): void {
  const mime = asset.mimeType ?? mimeFromAssetUri(asset.uri);
  if (!ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
    throw new UploadError('Use a JPG, PNG or WebP image.');
  }

  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new UploadError(
      `That image is ${(asset.fileSize / 1024 / 1024).toFixed(1)}MB. The limit is 5MB.`,
    );
  }

  const { width, height } = asset;
  if (typeof width === 'number' && typeof height === 'number') {
    const shortEdge = Math.min(width, height);
    const floor = minDimension ?? MIN_DIMENSION;
    if (shortEdge < floor) {
      throw new UploadError(
        `That image is only ${shortEdge}px wide. Use one at least ${floor}px.`,
      );
    }
    if (Math.max(width, height) > MAX_DIMENSION) {
      throw new UploadError(`Images must be ${MAX_DIMENSION}px or smaller.`);
    }
  }
}

/**
 * A lower resolution floor for chat attachments.
 *
 * Screenshots and quick room photos are routinely smaller than the listing
 * minimum; rejecting them would be a bug, not protection.
 */
export const MIN_CHAT_DIMENSION = 200;

const mimeFromAssetUri = (uri: string): string => {
  const ext = ALLOWED_EXTENSIONS.find((e) => uri.toLowerCase().endsWith(e));
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
};

/** Requests the photo-library permission and returns the user's picks. */
export async function pickImages(maxCount: number): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new UploadError('Allow photo access in Settings to attach images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: maxCount > 1,
    selectionLimit: maxCount,
    // Aspect 4:3 matches the website's listing gallery crop and keeps every
    // image in a grid the same height.
    aspect: [4, 3],
    // Downscale before upload so even a 48MP phone photo lands under the limit.
    quality: 0.8,
  });

  if (result.canceled) return [];
  return result.assets;
}

/**
 * Picks a single image for a chat attachment.
 *
 * Differs from `pickImages` in two ways: it keeps the photo's own aspect ratio
 * (a chat thumbnail that crops a receipt mid-line is useless) and it compresses
 * harder, since chat images travel over phone data far more often than listing
 * photos do. Returns `null` when the user backs out.
 */
export async function pickChatImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new UploadError('Allow photo access in Settings to attach a picture.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.7,
  });

  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

export interface UploadOptions {
  /** Listing-scoped folder, e.g. `marketplace/<id>`. Passed as the `folder` tag. */
  folder: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: { aborted: boolean };
  /** Overrides the short-edge resolution floor. See `MIN_CHAT_DIMENSION`. */
  minDimension?: number;
}

/**
 * Uploads a single picked asset and returns its stored URL.
 *
 * Uses `XMLHttpRequest` rather than `fetch` because it is the only transport in
 * React Native that reports real upload progress, which the website relies on
 * for its progress bar.
 */
export async function uploadImage(
  asset: ImagePicker.ImagePickerAsset,
  { folder, onProgress, signal, minDimension }: UploadOptions,
): Promise<UploadedImage> {
  validateImage(asset, { minDimension });

  const form = new FormData();
  const uri =
    Platform.OS === 'android'
      ? asset.uri.replace('file://', '')
      : asset.uri;

  // React Native's FormData accepts this shape for a file part; the cast is the
  // community-standard workaround for the missing lib.dom types.
  form.append('file', {
    uri,
    name: `jid-${Date.now()}.${mimeFromAssetUri(asset.uri).split('/')[1]}`,
    type: asset.mimeType ?? mimeFromAssetUri(asset.uri),
  } as unknown as Blob);

  form.append('upload_preset', env.cloudinaryUploadPreset);
  form.append('folder', `jid/${folder}`);
  // Context travels with the asset so Cloudinary-side transformations stay
  // addressable later.
  form.append('context', `source=jid-mobile|platform=${Platform.OS}`);

  const endpoint = `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`;
  const xmlHttpRequest = new XMLHttpRequest();

  return new Promise<UploadedImage>((resolve, reject) => {
    const xhr = xmlHttpRequest;

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress({ progress: Math.min(event.loaded / event.total, 1) });
        }
      };
    }

    xhr.onload = () => {
      if (signal?.aborted) {
        reject(new UploadError('Upload cancelled.'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `Upload failed (${xhr.status}).`;
        try {
          const parsed = JSON.parse(xhr.responseText) as { error?: { message?: string } };
          if (parsed.error?.message) message = parsed.error.message;
        } catch {
          // Non-JSON error body; keep the status-code message.
        }
        reject(new UploadError(message));
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as {
          secure_url: string;
          public_id: string;
          width: number;
          height: number;
          bytes: number;
        };
        resolve({
          url: parsed.secure_url,
          publicId: parsed.public_id,
          width: parsed.width,
          height: parsed.height,
          bytes: parsed.bytes,
        });
      } catch {
        reject(new UploadError("Cloudinary sent a response we couldn't read."));
      }
    };

    xhr.onerror = () =>
      reject(new UploadError("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new UploadError('Upload cancelled.'));

    xhr.open('POST', endpoint);
    xhr.send(form);
  });
}

/**
 * Uploads assets sequentially rather than in parallel.
 *
 * Phone uplinks choke on concurrent large bodies, and sequential uploads give
 * an honest combined progress bar.
 */
export async function uploadMany(
  assets: ImagePicker.ImagePickerAsset[],
  options: UploadOptions,
): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];
  for (let index = 0; index < assets.length; index += 1) {
    if (options.signal?.aborted) throw new UploadError('Upload cancelled.');
    const result = await uploadImage(assets[index], {
      ...options,
      onProgress: ({ progress }) => {
        // Report combined progress so the bar advances smoothly.
        options.onProgress?.({
          progress: (index + progress) / Math.max(assets.length, 1),
        });
      },
    });
    uploaded.push(result);
  }
  return uploaded;
}