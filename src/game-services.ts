import { createClient } from "@supabase/supabase-js";
import { createGameServices, type GameServices } from "@supagame/sdk-ts";

export function configuredGameServices(): GameServices | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return undefined;
  try {
    // Supabase's defaults persist sessions and refresh tokens in browser storage.
    const supabase = createClient(url, key);
    return createGameServices({ supabase });
  } catch {
    // Missing/invalid browser configuration must not prevent local play.
    return undefined;
  }
}
