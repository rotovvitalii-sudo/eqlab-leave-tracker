import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Серверний клієнт для Server Components і Server Actions. Лише publishable-ключ.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Виклик із Server Component: сесію оновлює proxy.
          }
        },
      },
    },
  );
}
