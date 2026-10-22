import { createBrowserClient } from "@supabase/ssr";

// Браузерний клієнт — лише для завантаження файлів у Storage (минає ліміт розміру Server Actions).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
