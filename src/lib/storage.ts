const PREFIX = "wavelength:";

/**
 * Reads a saved preference. Returns `fallback` if nothing is saved, the saved
 * value fails `isValid`, or storage is unavailable (private mode, blocked).
 */
export function readStored<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T
): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage is unavailable or full; preferences just won't persist.
  }
}
