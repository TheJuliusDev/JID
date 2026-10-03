/**
 * Camera, gallery, image compression and voice capture for chat.
 *
 * Everything here is plain Web API — `getUserMedia`, `MediaRecorder`, `canvas` —
 * so there is no extra dependency to ship to a mid-range Android. Each function
 * reports real progress and rejects with a student-readable message, because the
 * composer surfaces those verbatim next to a Retry button.
 *
 * Audio uploads reuse the Cloudinary account already configured for images.
 * Cloudinary serves audio through its `video` endpoint, which is why the upload
 * below posts to `/video/upload` rather than `/raw/upload`.
 */
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, hasCloudinaryConfig } from '../config/env';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Long-edge cap. 1600px is sharp on a 2x phone screen and small enough to
 *  upload quickly on a campus 3G/4G connection. */
const MAX_IMAGE_EDGE = 1600;
/** Chat images are re-encoded to WebP at q0.72 — typically 60–120 KB. */
const IMAGE_QUALITY = 0.72;
export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_VOICE_SECONDS = 120;

export interface CompressionResult {
  file: File;
  width: number;
  height: number;
  /** Object URL the caller must revoke when it is done previewing. */
  previewUrl: string;
}

/** True when the browser can give us a camera stream at all. */
export function canRecordVoice(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

/** iOS Safari only exposes the audio/webm codecs in recent versions. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4', // Safari
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * Downscale and re-encode an image for chat.
 *
 * Runs entirely on an OffscreenCanvas (with a DOM-canvas fallback) so the main
 * thread keeps painting — decoding a 12 MP phone photo on the UI thread is a
 * visible stall on a low-end device.
 */
export async function compressImage(file: File): Promise<CompressionResult> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = await createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process the image.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  closeBitmap(bitmap);

  const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_QUALITY);
  // WebP is unsupported on some older Android WebViews; ship the original rather
  // than failing the send.
  const outBlob = blob || file;
  const outFile = new File([outBlob], renameForUpload(file.name), {
    type: outBlob.type || file.type,
    lastModified: Date.now(),
  });

  return { file: outFile, width, height, previewUrl: URL.createObjectURL(outFile) };
}

function renameForUpload(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').slice(0, 40) || 'chat-image';
  return `${base}.webp`;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `imageOrientation` makes EXIF-rotated phone photos come out upright.
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = url;
    });
    return img;
  } finally {
    // The <img> keeps its own decoded copy, so the URL can go immediately.
    URL.revokeObjectURL(url);
  }
}

function closeBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
  if (typeof (bitmap as ImageBitmap).close === 'function') (bitmap as ImageBitmap).close();
}

async function createCanvas(width: number, height: number): Promise<HTMLCanvasElement | OffscreenCanvas> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(width, height);
    } catch {
      /* fall through */
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number
): Promise<Blob | null> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Upload one chat image to Cloudinary with real progress.
 *
 * Mirrors `uploadImage` in `cloudinary.ts` but adds a client-side
 * transformation so Cloudinary does not have to resize, and marks the delivery
 * as private-to-JID rather than a public listing asset.
 */
export function uploadChatImage(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!hasCloudinaryConfig) {
    return Promise.reject(
      new Error('Photo uploads are not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.')
    );
  }

  return new Promise<string>((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'jid/chat');
    // Same long-edge cap as the client-side pass; belt and braces for any
    // client that skipped compression.
    formData.append('transformation', 'c_limit,w_1600,q_auto,f_webp');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
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
          onProgress?.(100);
          resolve(data.secure_url as string);
        } catch {
          reject(new Error('Could not read the upload response.'));
        }
      } else {
        reject(new Error(readXhrError(xhr)));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    if (signal) {
      if (signal.aborted) xhr.abort();
      else signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}

/**
 * Upload a recorded voice note. Cloudinary exposes audio through the `video`
 * endpoint; `resource_type: audio` on the response is how we get an audio URL.
 */
export function uploadVoiceNote(
  blob: Blob,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!hasCloudinaryConfig) {
    return Promise.reject(
      new Error('Voice messages are not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.')
    );
  }

  return new Promise<string>((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', blob, 'jid-voice-note.webm');
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'jid/voice');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const url = data.secure_url?.replace(/\.(webm|ogg|mp4)$/i, '.mp3');
          if (!url) {
            reject(new Error('Upload did not return an audio URL.'));
            return;
          }
          onProgress?.(100);
          resolve(url);
        } catch {
          reject(new Error('Could not read the upload response.'));
        }
      } else {
        reject(new Error(readXhrError(xhr)));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and try again.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    if (signal) {
      if (signal.aborted) xhr.abort();
      else signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}

function readXhrError(xhr: XMLHttpRequest): string {
  let message = `Upload failed (${xhr.status}).`;
  try {
    const data = JSON.parse(xhr.responseText);
    if (data?.error?.message) message = data.error.message;
  } catch {
    /* keep the generic message */
  }
  return message;
}

// ---------------------------------------------------------------------------
// Voice capture
// ---------------------------------------------------------------------------

export interface RecordedVoice {
  blob: Blob;
  durationMs: number;
  /** Normalised 0..1 peaks for the waveform, ~48 of them. */
  peaks: number[];
  /** Object URL the caller must revoke. */
  previewUrl: string;
}

/**
 * Hold-to-record voice capture.
 *
 * Amplitudes are sampled from an AnalyserNode while recording and squashed into
 * `PEAK_BUCKETS` bars, so the waveform is drawn from data captured at record
 * time — playback never decodes audio to render it.
 */
const PEAK_BUCKETS = 48;

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId = 0;
  private startedAt = 0;

  /** Raw 0..1 samples for the live meter while the finger is held down. */
  onLevel?: (level: number) => void;

  async start(): Promise<void> {
    if (!canRecordVoice()) {
      throw new Error('This browser cannot record audio.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.startLevelMeter();
    this.startedAt = Date.now();
    this.recorder.start(250); // timeslice keeps memory flat on a long recording
  }

  /** Stop and resolve with the recording. The stream is always released. */
  stop(): Promise<RecordedVoice> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      const stream = this.stream;
      const durationMs = Date.now() - this.startedAt;

      this.stopLevelMeter();
      this.teardownAudioGraph();

      if (!recorder || recorder.state === 'inactive') {
        this.releaseStream(stream);
        reject(new Error('Nothing was recorded.'));
        return;
      }

      const capturedPeaks = this.capturedPeaks;
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.releaseStream(stream);
        if (blob.size === 0) {
          reject(new Error('Nothing was recorded.'));
          return;
        }
        resolve({
          blob,
          durationMs,
          peaks: capturedPeaks,
          previewUrl: URL.createObjectURL(blob),
        });
      };
      recorder.onerror = () => {
        this.releaseStream(stream);
        reject(new Error('Recording failed. Please try again.'));
      };
      try {
        recorder.stop();
      } catch {
        this.releaseStream(stream);
        reject(new Error('Recording failed. Please try again.'));
      }
    });
  }

  /**
   * Milliseconds since recording began.
   *
   * Public because the composer needs it to run its own countdown and enforce
   * `MAX_VOICE_SECONDS` — reaching into `startedAt` would make the cap a
   * private-field reach-around, and would silently break if it were renamed.
   */
  get elapsedMs(): number {
    return this.startedAt === 0 ? 0 : Date.now() - this.startedAt;
  }

  /** Abandon the recording and free the microphone. */
  cancel(): void {
    this.stopLevelMeter();
    this.teardownAudioGraph();
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    this.releaseStream(this.stream);
    this.chunks = [];
    this.capturedPeaks = [];
  }

  private capturedPeaks: number[] = [];

  private startLevelMeter(): void {
    if (!this.stream) return;
    try {
      const Ctx: typeof AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new Ctx();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
        // Perceptual curve, so quiet speech still moves the meter.
        const level = Math.min(1, Math.sqrt(rms) * 1.8);
        this.onLevel?.(level);
        this.capturedPeaks.push(level);
        // Bound the buffer: 250ms timeslice x 120s max would be 480 samples.
        if (this.capturedPeaks.length > 2000) this.capturedPeaks.shift();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    } catch {
      // Metering is a nicety; recording still works without it.
      this.analyser = null;
    }
  }

  private stopLevelMeter(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.onLevel = undefined;
  }

  private teardownAudioGraph(): void {
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  private releaseStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
  }
}

/**
 * Compress a long capture into a fixed number of bars.
 *
 * Falls back to an even ramp when there is no metering data, so the bubble
 * never renders as a flat line for a reason the student cannot see.
 */
export function toWaveformPeaks(samples: number[], buckets = PEAK_BUCKETS): number[] {
  if (!samples.length) {
    return Array.from({ length: buckets }, (_, i) => 0.25 + 0.35 * Math.abs(Math.sin(i / 3)));
  }
  const peaks: number[] = [];
  const size = samples.length / buckets;
  for (let b = 0; b < buckets; b += 1) {
    const start = Math.floor(b * size);
    const end = Math.max(start + 1, Math.floor((b + 1) * size));
    let max = 0;
    for (let i = start; i < end && i < samples.length; i += 1) {
      if (samples[i] > max) max = samples[i];
    }
    peaks.push(Math.max(0.06, Math.min(1, max)));
  }
  // Normalise so a quiet recording still reads as a waveform.
  const ceiling = Math.max(...peaks, 0.2);
  return peaks.map((p) => Math.max(0.08, Math.min(1, p / ceiling)));
}
