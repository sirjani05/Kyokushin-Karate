import { createClient } from "@supabase/supabase-js";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function isServiceRoleKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims === "object" && claims !== null && "role" in claims && claims.role === "service_role";
  } catch {
    return false;
  }
}

export const supabaseConfigurationError = (() => {
  if (!supabaseUrl || !supabaseKey) {
    return "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file.";
  }
  if (isServiceRoleKey(supabaseKey)) {
    return "A service-role key cannot be used in this desktop app. Use the project's publishable key.";
  }

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "VITE_SUPABASE_URL must use HTTPS (HTTP is allowed for local development).";
    }
  } catch {
    return "VITE_SUPABASE_URL must be a valid URL.";
  }
  return null;
})();

const desktopSessionStorage = {
  getItem: (key: string): Promise<string | null> =>
    invoke<string | null>("secure_store_get", { key }),
  setItem: (key: string, value: string): Promise<void> =>
    invoke("secure_store_set", { key, value }),
  removeItem: (key: string): Promise<void> =>
    invoke("secure_store_delete", { key }),
};

const browserSessionStorage = {
  getItem: async (key: string): Promise<string | null> => window.sessionStorage.getItem(key),
  setItem: async (key: string, value: string): Promise<void> => {
    window.sessionStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    window.sessionStorage.removeItem(key);
  },
};

export const supabase =
  !supabaseConfigurationError && supabaseUrl && supabaseKey
    ? createClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
          storage: isTauri() ? desktopSessionStorage : browserSessionStorage,
        },
      })
    : null;
