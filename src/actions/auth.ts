"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/login-rate-limit";
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

  const identifier = email.toLowerCase();
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (await isLoginRateLimited(identifier, ip)) {
    return { error: "Demasiados intentos. Espere unos minutos e intente de nuevo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  await recordLoginAttempt(identifier, ip, !error);

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

// Usado tanto para aceptar una invitación como para completar un reset de
// contraseña — en ambos casos /auth/confirm ya dejó al usuario con sesión
// activa antes de llegar aquí.
export async function setPassword(_prev: { error: string } | null, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No se pudo actualizar la contraseña. Intenta de nuevo." };
  }

  redirect("/dashboard");
}

// Siempre responde igual, exista o no la cuenta — mismo principio
// anti-enumeración que signIn.
export async function requestPasswordReset(
  _prev: { sent: boolean } | null,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  if (email) {
    const supabase = await createClient();
    // El template de correo ("Reset password") es el que arma la URL final
    // hacia /auth/confirm con token_hash y type — este redirectTo es solo el
    // destino final ({{ .RedirectTo }} en el template), igual que inviteUser.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
    });
  }
  return { sent: true };
}
