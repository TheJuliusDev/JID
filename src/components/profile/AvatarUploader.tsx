import React, { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { uploadImage, validateImageFile } from '../../services/cloudinary';

interface AvatarUploaderProps {
  /** Display name used for the fallback initial. */
  name: string;
  avatarUrl?: string;
  /** Tailwind size classes for the circle, e.g. `w-24 h-24`. */
  sizeClass?: string;
  /** Tailwind size classes for the fallback initial. */
  initialClass?: string;
  /** Show a small remove button (used in the settings tab). */
  showRemove?: boolean;
  /** Called with the new Cloudinary URL, or `null` when the photo is removed. */
  onChange: (url: string | null) => Promise<void>;
}

/**
 * Round profile-picture picker. Photos go straight to Cloudinary (folder
 * `jid/avatars`) and only the resulting HTTPS URL is handed back to the caller,
 * which persists it to the user's profile row. Reports real progress and
 * inline validation/upload errors.
 */
export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  name,
  avatarUrl,
  sizeClass = 'w-24 h-24',
  initialClass = 'text-2xl',
  showRemove = false,
  onChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const res = await uploadImage(file, {
        folder: 'jid/avatars',
        onProgress: (p) => setProgress(p),
      });
      setProgress(null);
      await onChange(res.url);
    } catch (err: any) {
      setProgress(null);
      setError(err?.message || 'Could not upload your photo. Please try again.');
    }
  };

  const handleRemove = async () => {
    setError(null);
    await onChange(null);
  };

  return (
    <div>
      <div className="relative inline-block">
        <div
          className={`relative ${sizeClass} rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-950 border-2 border-emerald-500/30 flex-shrink-0`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center font-bold text-emerald-600 ${initialClass}`}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          {progress !== null && (
            <div className="absolute inset-0 bg-zinc-950/60 flex flex-col items-center justify-center gap-1">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span className="text-[10px] font-bold text-white">{progress}%</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          aria-label="Change profile photo"
          title="Change profile photo"
          className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md ring-2 ring-white dark:ring-zinc-950 cursor-pointer transition-colors disabled:opacity-60"
        >
          <Camera className="w-4 h-4" />
        </button>

        {showRemove && avatarUrl && progress === null && (
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove profile photo"
            title="Remove profile photo"
            className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-md ring-2 ring-white dark:ring-zinc-950 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 max-w-[240px]">{error}</p>
      )}
    </div>
  );
};