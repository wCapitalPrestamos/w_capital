import { useSyncExternalStore } from "react";

// Reloj cuantizado a 30 s (0 en el servidor) — permite comparar contra
// Date.now() en cálculos derivados sin llamar a una función impura durante
// el render. Compartido entre Thread y ConversationList.
export function useMinuteNow(): number {
  return useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, 30_000);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => 0,
  );
}
