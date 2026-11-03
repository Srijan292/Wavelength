import type { Backend } from "./types";
import { createSupabaseBackend } from "./supabaseBackend";
import { createDemoBackend } from "./demoBackend";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

/**
 * The one backend the whole app uses. With both Supabase variables set it
 * talks to Supabase; with neither, it runs in offline demo mode. A half-set
 * configuration is almost certainly a mistake, so it fails loudly instead of
 * silently falling back to demo mode.
 */
function chooseBackend(): Backend {
  if (supabaseUrl && supabaseAnonKey) {
    return createSupabaseBackend(supabaseUrl, supabaseAnonKey);
  }
  if (supabaseUrl || supabaseAnonKey) {
    throw new Error(
      "Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, or neither to run in demo mode."
    );
  }
  return createDemoBackend();
}

export const backend: Backend = chooseBackend();
export type { Backend, Song, SongPatch, AppUser, AuthResult } from "./types";
