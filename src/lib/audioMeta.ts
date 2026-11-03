const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
};

/** Browsers often leave File.type empty for flac/m4a, so fall back to the extension. */
export function guessContentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/** Storage keys must be plain ASCII; anything else becomes an underscore. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export function titleFromFileName(name: string): string {
  const withoutExtension = name.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : "Untitled";
}

/**
 * Reads a file's duration in the browser before upload, without touching the
 * network. Resolves null (never rejects) if the browser can't read it.
 */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    // Some formats never fire loadedmetadata or error; don't hang the upload on them.
    const timer = window.setTimeout(() => finish(null), 8000);

    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () => {
      finish(Number.isFinite(audio.duration) ? audio.duration : null);
    });
    audio.addEventListener("error", () => finish(null));
    audio.src = objectUrl;
  });
}
