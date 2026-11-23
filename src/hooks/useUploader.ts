import { useCallback, useRef, useState } from "react";
import { guessContentType } from "../lib/audioMeta";

const MAX_ERRORS_SHOWN = 3;

/**
 * Uploads files one at a time and tracks progress and failures. Shared by the
 * "Upload songs" button and drag-and-drop so both behave identically.
 */
export function useUploader(upload: (file: File) => Promise<unknown>) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  // A ref, not state: two drops in the same tick must not both pass the check.
  const busyRef = useRef(false);

  const start = useCallback(
    async (fileList: FileList | File[] | null) => {
      if (!fileList || fileList.length === 0 || busyRef.current) return;
      busyRef.current = true;
      const files = Array.from(fileList);
      const failures: string[] = [];
      setErrors([]);
      setProgress({ done: 0, total: files.length });

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            if (!guessContentType(file).startsWith("audio/")) {
              throw new Error("this isn't an audio file.");
            }
            await upload(file);
          } catch (err) {
            const reason = err instanceof Error ? err.message : "something went wrong.";
            failures.push(`Couldn't upload ${file.name}: ${reason}`);
          }
          setProgress({ done: i + 1, total: files.length });
        }
      } finally {
        busyRef.current = false;
        setProgress(null);
        setErrors(failures);
      }
    },
    [upload]
  );

  const shown = errors.slice(0, MAX_ERRORS_SHOWN);
  return {
    progress,
    busy: progress !== null,
    errors: shown,
    hiddenErrors: Math.max(0, errors.length - shown.length),
    start,
  };
}
