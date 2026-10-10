/**
 * A message in the chat transcript, including photos that have not landed yet.
 *
 * A confirmed `Message` is a row from Postgres. An `OptimisticPhoto` is a local
 * placeholder that exists only in the sender's own transcript while the bytes
 * are still travelling to Cloudinary. The thread merges the two into one
 * ordered list, so a photo appears the instant it is picked — uploading in the
 * background rather than making the user watch a spinner before seeing what
 * they sent.
 *
 * The placeholder carries its own `clientId` and `createdAt` so it sorts into
 * the transcript in the right position, and so the real row can replace it once
 * the upload and insert both succeed.
 */
import type { Message } from '@/types';

export type PhotoSendStatus = 'uploading' | 'failed';

export interface OptimisticPhoto {
  /** Stable local identity; the row id is not known until insert. */
  clientId: string;
  conversationId: string;
  senderId: string;
  /** Local file URI from the picker, shown until Cloudinary has it. */
  localUri: string;
  /** The picked asset, kept so a retry re-uploads without re-prompting. */
  asset: ImagePickerAssetLike;
  status: PhotoSendStatus;
  /** 0..1, from the XHR upload progress event. */
  progress: number;
  /** Set when `status` is `failed`. */
  error?: string;
  /** ISO stamp, used only to place the placeholder in transcript order. */
  createdAt: string;
}

/**
 * The slice of `expo-image-picker`'s asset we keep.
 *
 * Declared structurally rather than importing the type so this module carries
 * no dependency on the native picker and can be unit-tested or imported freely.
 */
export interface ImagePickerAssetLike {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string | null;
}

export type ThreadItem =
  | { type: 'message'; message: Message }
  | { type: 'photo'; photo: OptimisticPhoto };

const createdAtOf = (item: ThreadItem): string =>
  item.type === 'message' ? item.message.createdAt : item.photo.createdAt;

/** Monotonic client ids. A counter beats bare `Date.now()` on rapid re-sends. */
let photoCounter = 0;
export const nextPhotoClientId = (): string => {
  photoCounter += 1;
  return `local-photo-${Date.now()}-${photoCounter}`;
};

/**
 * Merges confirmed messages with in-flight photo placeholders into one
 * chronological transcript, oldest first.
 */
export const mergeThread = (
  messages: Message[],
  photos: OptimisticPhoto[],
  conversationId: string,
): ThreadItem[] => {
  const merged: ThreadItem[] = [
    ...messages.map((message): ThreadItem => ({ type: 'message', message })),
    ...photos
      .filter((photo) => photo.conversationId === conversationId)
      .map((photo): ThreadItem => ({ type: 'photo', photo })),
  ];

  // Stable sort, so a photo and a text message sent together keep their order.
  return merged.sort((a, b) => createdAtOf(a).localeCompare(createdAtOf(b)));
};

/**
 * True when a confirmed row and a placeholder are the same send.
 *
 * Realtime `INSERT`s can land before the local `sendMessage` promise resolves,
 * so the caller needs a way to drop a placeholder once its real row shows up.
 * The window is deliberately generous at the start — a row can be committed
 * slightly before the device stamped the placeholder — and short at the end, so
 * two genuinely separate sends from the same person are never conflated.
 */
export const placeholderMatchesMessage = (
  photo: OptimisticPhoto,
  message: Message,
): boolean => {
  if (message.senderId !== photo.senderId) return false;
  const delta = new Date(message.createdAt).getTime() - new Date(photo.createdAt).getTime();
  return delta >= -10_000 && delta <= 5 * 60_000;
};

/** Removes placeholders that the real transcript has caught up with. */
export const withoutSettledPhotos = (
  photos: OptimisticPhoto[],
  messages: Message[],
): OptimisticPhoto[] => {
  if (photos.length === 0) return photos;
  return photos.filter((photo) => !messages.some((message) => placeholderMatchesMessage(photo, message)));
};