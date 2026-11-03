import type { AppUser, Backend, Song } from "./types";
import { synthesizeDemoTracks } from "./demoAudio";
import { titleFromFileName } from "../audioMeta";

const DEMO_USER_ID = "demo-user";

/**
 * An in-memory stand-in for the real backend. Nothing is persisted: a page
 * reload starts over. It exists so the whole UI can be run and reviewed
 * before a Supabase project is set up.
 */
export function createDemoBackend(): Backend {
  let user: AppUser | null = null;
  let songs: Song[] = [];
  const urlBySongId = new Map<string, string>();
  const listeners = new Set<(user: AppUser | null) => void>();

  function emit() {
    for (const listener of listeners) listener(user);
  }

  function seedIfEmpty() {
    if (songs.length > 0) return;
    const now = Date.now();
    songs = synthesizeDemoTracks().map((track, index) => {
      const id = crypto.randomUUID();
      urlBySongId.set(id, track.url);
      return {
        id,
        user_id: DEMO_USER_ID,
        title: track.title,
        artist: "Wavelength Demo",
        album: null,
        duration: track.duration,
        storage_path: id,
        thumbnail_path: null,
        created_at: new Date(now - index * 1000).toISOString(),
      };
    });
  }

  function signInWith(email: string) {
    user = { id: DEMO_USER_ID, email: email.trim() || "demo@wavelength.app" };
    seedIfEmpty();
    emit();
  }

  return {
    mode: "demo",

    onAuthChange(callback) {
      listeners.add(callback);
      // Match the real backend: report the current state right away, asynchronously.
      void Promise.resolve().then(() => {
        if (listeners.has(callback)) callback(user);
      });
      return () => {
        listeners.delete(callback);
      };
    },

    async signUp(email) {
      signInWith(email);
      return { error: null, needsConfirmation: false };
    },

    async signIn(email) {
      signInWith(email);
      return { error: null };
    },

    async signOut() {
      user = null;
      emit();
    },

    async listSongs() {
      return [...songs];
    },

    async addSong(file, duration) {
      const id = crypto.randomUUID();
      urlBySongId.set(id, URL.createObjectURL(file));
      const song: Song = {
        id,
        user_id: DEMO_USER_ID,
        title: titleFromFileName(file.name),
        artist: null,
        album: null,
        duration,
        storage_path: id,
        thumbnail_path: null,
        created_at: new Date().toISOString(),
      };
      songs = [song, ...songs];
      return song;
    },

    async updateSong(id, patch) {
      const existing = songs.find((s) => s.id === id);
      if (!existing) throw new Error("Song not found.");
      const updated = { ...existing, ...patch };
      songs = songs.map((s) => (s.id === id ? updated : s));
      return updated;
    },

    async removeSong(song) {
      songs = songs.filter((s) => s.id !== song.id);
      const url = urlBySongId.get(song.id);
      if (url) URL.revokeObjectURL(url);
      urlBySongId.delete(song.id);
    },

    async getPlayableUrl(song) {
      const url = urlBySongId.get(song.id);
      if (!url) throw new Error("This demo track is no longer available.");
      return url;
    },
  };
}
