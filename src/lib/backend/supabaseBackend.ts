import { createClient } from "@supabase/supabase-js";
import type {
  AppUser,
  AuthResult,
  Backend,
  Song,
  SongPatch,
} from "./types";
import {
  guessContentType,
  sanitizeFileName,
  titleFromFileName,
} from "../audioMeta";

const SONGS_BUCKET = "songs";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // one hour is plenty for a listening session

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const supabase = createClient(url, anonKey);

  async function requireUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("You must be signed in.");
    return data.user.id;
  }

  return {
    mode: "supabase",

    onAuthChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const user: AppUser | null = session?.user
          ? { id: session.user.id, email: session.user.email ?? "" }
          : null;
        callback(user);
      });
      return () => data.subscription.unsubscribe();
    },

    async signUp(email, password): Promise<AuthResult> {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      // With "Confirm email" on, Supabase returns a user but no session.
      return { error: null, needsConfirmation: data.session === null };
    },

    async signIn(email, password): Promise<AuthResult> {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error?.message ?? null };
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    async listSongs() {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as Song[];
    },

    async addSong(file, duration) {
      const userId = await requireUserId();
      const storagePath = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(
        file.name
      )}`;

      const { error: uploadError } = await supabase.storage
        .from(SONGS_BUCKET)
        .upload(storagePath, file, {
          contentType: guessContentType(file),
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);

      const { data, error: insertError } = await supabase
        .from("songs")
        .insert({
          user_id: userId,
          title: titleFromFileName(file.name),
          artist: null,
          album: null,
          duration,
          storage_path: storagePath,
          thumbnail_path: null,
        })
        .select()
        .single();

      if (insertError) {
        // Don't leave an orphaned file behind if the metadata row failed.
        await supabase.storage.from(SONGS_BUCKET).remove([storagePath]);
        throw new Error(insertError.message);
      }
      return data as Song;
    },

    async updateSong(id: string, patch: SongPatch) {
      const { data, error } = await supabase
        .from("songs")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Song;
    },

    async removeSong(song) {
      // Row first: if the file removal then fails we're left with a harmless
      // orphan file, not a library entry that points at nothing.
      const { error: dbError } = await supabase
        .from("songs")
        .delete()
        .eq("id", song.id);
      if (dbError) throw new Error(dbError.message);

      const { error: storageError } = await supabase.storage
        .from(SONGS_BUCKET)
        .remove([song.storage_path]);
      if (storageError) throw new Error(storageError.message);
    },

    async getPlayableUrl(song) {
      const { data, error } = await supabase.storage
        .from(SONGS_BUCKET)
        .createSignedUrl(song.storage_path, SIGNED_URL_TTL_SECONDS);
      if (error || !data) {
        throw new Error(error?.message ?? "Could not create a playback URL.");
      }
      return data.signedUrl;
    },
  };
}
