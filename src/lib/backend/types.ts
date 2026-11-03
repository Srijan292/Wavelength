export interface Song {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null; // seconds
  storage_path: string; // path inside the "songs" storage bucket (or a demo id)
  thumbnail_path: string | null; // used from Phase 2 on
  created_at: string;
}

export type SongPatch = Partial<Pick<Song, "title" | "artist" | "album">>;

export interface AppUser {
  id: string;
  email: string;
}

export interface AuthResult {
  error: string | null;
  /** Sign-up only: true when the user must confirm their email before signing in. */
  needsConfirmation?: boolean;
}

/**
 * Everything the UI needs from a backend. The UI only ever talks to this
 * interface, so the Supabase implementation and the offline demo one are
 * interchangeable.
 */
export interface Backend {
  mode: "supabase" | "demo";
  /** Calls back with the current user right away, then on every change. Returns an unsubscribe function. */
  onAuthChange(callback: (user: AppUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  listSongs(): Promise<Song[]>;
  addSong(file: File, duration: number | null): Promise<Song>;
  updateSong(id: string, patch: SongPatch): Promise<Song>;
  removeSong(song: Song): Promise<void>;
  /** A URL the <audio> element can load for this song. */
  getPlayableUrl(song: Song): Promise<string>;
}
