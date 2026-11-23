import { useRef } from "react";

interface UploadButtonProps {
  busy: boolean;
  progress: { done: number; total: number } | null;
  errors: string[];
  hiddenErrors: number;
  onFiles: (files: FileList) => void;
}

export function UploadButton({
  busy,
  progress,
  errors,
  hiddenErrors,
  onFiles,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="upload-control">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
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
          {errors.map((message) => (
            <p key={message} className="form-error">
              {message}
            </p>
          ))}
          {hiddenErrors > 0 && (
            <p className="form-error">and {hiddenErrors} more failed.</p>
          )}
        </div>
      )}
    </div>
  );
}
