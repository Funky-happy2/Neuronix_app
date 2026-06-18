import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { KeyRound, Clock } from "lucide-react";

// Shows a countdown banner while a temporary guest-pass session is active, and
// logs the guest out automatically once the 10-minute window elapses.
export function GuestPassBanner() {
  const { user, logoutMutation } = useAuth();
  const restricted = (user as any)?.restricted === true;
  const expiresAt = (user as any)?.tempExpiresAt as number | null | undefined;
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!restricted || !expiresAt) return;
    const tick = () => {
      const ms = Number(expiresAt) - Date.now();
      setRemaining(ms);
      if (ms <= 0) {
        logoutMutation.mutate();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restricted, expiresAt, logoutMutation]);

  if (!restricted || !expiresAt) return null;

  const totalSec = Math.max(0, Math.floor(remaining / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, "0");

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm"
      data-testid="guest-pass-banner"
    >
      <KeyRound className="w-4 h-4" />
      <span>Guest pass</span>
      <span className="opacity-80">·</span>
      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {mm}:{ss} left</span>
      <span className="opacity-80 hidden sm:inline">· no spending or trading</span>
    </div>
  );
}
