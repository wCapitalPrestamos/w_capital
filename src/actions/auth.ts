"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Solo permite rutas internas de un solo segmento inicial ("/x"), nunca
// "//host" o "/\host" — ambos son interpretados como URL externa por el
// navegador y abrirían una redirección abierta hacia un sitio de phishing.
function safeNextPath(next: string): string {
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return "/dashboard";
}

export async function signIn(_prev: { error: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/dashboard"));

  if (!email || !password) {
    return { error: "Escribe tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
