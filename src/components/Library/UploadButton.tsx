import { useRef, useState } from "react";
import { guessContentType } from "../../lib/audioMeta";

interface UploadButtonProps {
  onUpload: (file: File) => Promise<unknown>;
}

const MAX_ERRORS_SHOWN = 3;

export function UploadButton({ onUpload }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const failures: string[] = [];
    setErrors([]);
    setProgress({ done: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (!guessContentType(file).startsWith("audio/")) {
          throw new Error("this isn't an audio file.");
        }
        await onUpload(file);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "something went wrong.";
        failures.push(`Couldn't upload ${file.name}: ${reason}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setProgress(null);
    setErrors(failures);
  }

  const busy = progress !== null;
  const hidden = Math.max(0, errors.length - MAX_ERRORS_SHOWN);

  return (
    <div className="upload-control">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = ""; // lets the same file be chosen again later
        }}
      />
      <button
        type="button"
        className="btn-primary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {progress
          ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
          : "Upload songs"}
      </button>
      {errors.length > 0 && (
        <div className="upload-control__errors" role="alert">
          {errors.slice(0, MAX_ERRORS_SHOWN).map((message) => (
            <p key={message} className="form-error">
              {message}
            </p>
          ))}
          {hidden > 0 && (
            <p className="form-error">and {hidden} more failed.</p>
          )}
        </div>
      )}
    </div>
  );
}
