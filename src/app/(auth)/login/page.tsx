import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-3xl font-black italic text-primary-foreground">
            W
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">W Capital</h1>
          <p className="text-sm text-muted-foreground">Impulsemos el futuro</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
