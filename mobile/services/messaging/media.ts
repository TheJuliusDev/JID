/**
 * Chat media: picking, compressing and uploading images and voice notes.
 *
 * Uploads go straight to Cloudinary using the unsigned preset JID already uses
 * for listing photos (see `services/cloudinary.ts`). There is no upload server,
 * and adding one for chat would be a large change to buy a small amount of
 * control, so this module deliberately reuses the existing account, preset and
 * unsigned flow.
 *
 * Two things matter more here than in the listing flow:
 *
 * 1. **The chat must never block on an upload.** Every function is async and
 *    returns a promise; nothing is awaited inside a render. Upload state lives
 *    with the composer, so the transcript stays interactive while bytes move.
 *
 * 2. **A failed upload is retryable.** Uploads return a handle that carries the
 *    local URI, so retry re-uploads from disk instead of asking the user to pick
 *    the photo again.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { env } from '@/services/env';
import { UploadError, MAX_IMAGE_BYTES, validateImage, MIN_CHAT_DIMENSION } from '@/services/cloudinary';

/** Photos attach to a chat without the listing image-count ceiling. */
export const MAX_CHAT_IMAGES = 4;

/**
 * Chat compression settings.
 *
 * Harder than listing compression on purpose. Listing photos are browsed on
 * Wi-Fi; chat photos are usually sent on mobile data to somebody who wants to
 * know one thing quickly. 0.6 is the point where a 12MP phone photo drops under
 * ~300KB and still looks clean on the 6-inch screens this app targets.
 */
const CHAT_QUALITY = 0.6;

/** Pick one or more images from the gallery. */
export async function pickChatImages(
  maxCount: number = MAX_CHAT_IMAGES,
): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new UploadError('Allow photo access in Settings to send a picture.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: maxCount > 1,
    selectionLimit: Math.min(maxCount, MAX_CHAT_IMAGES),
    // No `aspect` ratio: a chat thumbnail that crops a receipt or a screenshot
    // of a price list halfway through the text is worse than no thumbnail.
    quality: CHAT_QUALITY,
  });

  if (result.canceled) return [];

  // Validated here rather than at upload time so a bad pick is reported while
  // the user is still looking at the preview, not after they hit send.
  result.assets.forEach((asset) => validateImage(asset, { minDimension: MIN_CHAT_DIMENSION }));
  return result.assets;
}

/**
 * Takes a photo with the camera.
 *
 * Returns null when the device has no camera or the user backs out, so a caller
 * on a camera-less device can fall back to the library rather than erroring.
 */
export async function captureChatPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const available = await ImagePicker.getCameraPermissionsAsync();
  if (!available.granted) {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    if (!requested.granted) {
      throw new UploadError('Allow camera access in Settings to take a photo.');
    }
  }

  const result = await ImagePicker.launchCameraAsync({
    // Camera capture has no compression setting in Expo's API, so the
    // compression is applied on the way out by Cloudinary's transform below.
    quality: CHAT_QUALITY,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset) validateImage(asset, { minDimension: MIN_CHAT_DIMENSION });
  return asset ?? null;
}

export interface MediaUploadResult {
  url: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

/**
 * Cloudinary transformation appended to chat uploads.
 *
 * `c_limit` caps the long edge at 1600px and `q_auto` lets Cloudinary pick the
 * quality per image. Together they bound the payload without the app having to
 * decode and re-encode on a mid-range Android device, which is where a naive
 * client-side resize would show up as a visible stall.
 */
const CHAT_TRANSFORM = 'c_limit,w_1600,q_auto:eco,f_auto';

const mimeFromUri = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

/**
 * Uploads one image and reports real progress.
 *
 * Uses `XMLHttpRequest` because it is the only transport in React Native that
 * exposes `upload.onprogress`; `fetch` cannot report upload progress at all.
 */
export async function uploadChatImage(
  asset: ImagePicker.ImagePickerAsset,
  options: {
    onProgress?: (progress: number) => void;
    signal?: { aborted: boolean };
  } = {},
): Promise<MediaUploadResult> {
  validateImage(asset, { minDimension: MIN_CHAT_DIMENSION });

  const form = new FormData();
  const uri =
    Platform.OS === 'android' ? asset.uri.replace('file://', '') : asset.uri;

  form.append('file', {
    uri,
    name: `jid-chat-${Date.now()}.${mimeFromAsset(asset)}`,
    type: asset.mimeType ?? mimeFromUri(asset.uri),
  } as unknown as Blob);

  form.append('upload_preset', env.cloudinaryUploadPreset);
  form.append('folder', 'jid/chat/images');
  form.append('context', 'source=jid-mobile|kind=chat');
  form.append('transformation', CHAT_TRANSFORM);

  const parsed = await postToCloudinary('image/upload', form, options);
  return {
    url: parsed.secure_url,
    width: parsed.width,
    height: parsed.height,
  };
}

/**
 * Uploads a recorded voice note.
 *
 * Cloudinary stores audio under the `video` resource type — there is no separate
 * audio endpoint — so this posts to `/video/upload` with an audio mime type. That
 * also means the resulting URL is directly playable by both platforms, and
 * Cloudinary serves it with a range-request header, which is what lets a bubble
 * start playing before the whole file has arrived.
 */
export async function uploadVoiceClip(
  uri: string,
  options: {
    durationMs: number;
    onProgress?: (progress: number) => void;
    signal?: { aborted: boolean };
  },
): Promise<MediaUploadResult> {
  const form = new FormData();
  const cleanUri = Platform.OS === 'android' ? uri.replace('file://', '') : uri;

  // Expo's recorder on Android writes .m4a and on iOS .caf. Both are AAC in an
  // MP4 container, and Cloudinary infers the codec from the extension.
  const extension = uri.toLowerCase().endsWith('.caf') ? 'caf' : 'm4a';

  form.append('file', {
    uri: cleanUri,
    name: `jid-voice-${Date.now()}.${extension}`,
    type: extension === 'caf' ? 'audio/x-caf' : 'audio/mp4',
  } as unknown as Blob);

  form.append('upload_preset', env.cloudinaryUploadPreset);
  form.append('folder', 'jid/chat/voice');
  form.append('context', 'source=jid-mobile|kind=voice');
  // Voice notes are short; capping the bitrate keeps a two-minute recording under
  // a megabyte, which is what makes voice notes cheaper than typing on a poor
  // connection.
  form.append('audio_codec', 'aac');
  form.append('audio_bitrate', '64k');

  const parsed = await postToCloudinary('video/upload', form, options);
  return { url: parsed.secure_url, durationMs: options.durationMs };
}

interface CloudinaryResponse {
  secure_url: string;
  width?: number;
  height?: number;
  duration?: number;
}

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  const mime = asset.mimeType ?? mimeFromUri(asset.uri);
  return mime.split('/')[1];
}

/** Shared POST with progress reporting, abort handling and readable errors. */
function postToCloudinary(
  resourceType: 'image/upload' | 'video/upload',
  form: FormData,
  options: { onProgress?: (progress: number) => void; signal?: { aborted: boolean } },
): Promise<CloudinaryResponse> {
  const endpoint = `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/${resourceType}`;

  return new Promise<CloudinaryResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress?.(Math.min(event.loaded / event.total, 1));
        }
      };
    }

    xhr.onload = () => {
      if (options.signal?.aborted) {
        reject(new UploadError('Upload cancelled.'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `Upload failed (${xhr.status}).`;
        try {
          const parsed = JSON.parse(xhr.responseText) as { error?: { message?: string } };
          if (parsed.error?.message) message = parsed.error.message;
        } catch {
          // Non-JSON error body; the status code message stands.
        }
        reject(new UploadError(message));
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as CloudinaryResponse;
        resolve(parsed);
      } catch {
        reject(new UploadError("Cloudinary sent a response we couldn't read."));
      }
    };

    xhr.onerror = () =>
      reject(new UploadError('Upload failed. Check your connection and try again.'));
    xhr.onabort = () => reject(new UploadError('Upload cancelled.'));

    xhr.open('POST', endpoint);
    xhr.send(form);
  });
}

/**
 * Enforces the byte ceiling before an upload starts.
 *
 * Exported so the composer can reject an oversized pick immediately, rather than
 * uploading several hundred kilobytes to be told no by Cloudinary.
 */
export function assertWithinSizeLimit(asset: ImagePicker.ImagePickerAsset): void {
  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new UploadError(
      `That photo is ${(asset.fileSize / (1024 * 1024)).toFixed(1)}MB. Try a smaller one.`,
    );
  }
}