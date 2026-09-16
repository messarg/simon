/**
 * Help that is present, not filed away (§7.5): a `?` on each screen explaining *this* screen in two
 * sentences, and the same words shown once, unprompted, the first time a person opens that screen.
 * Coach marks are per person, not per device — Գոռ should not be taught the till again because he
 * picked up the other phone (§11 `User.coachMarksSeen`).
 */
import { useQuery } from "@tanstack/react-query";
import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t, type StringKey } from "@/i18n/t.ts";
import { http } from "@/lib/http.ts";
import { screenFor } from "@/lib/screens.ts";
import { useSession } from "@/lib/session-store.ts";

export function ScreenHelp() {
  const { pathname } = useLocation();
  const session = useSession();
  const screen = screenFor(pathname);
  const [asked, setAsked] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => http.get<{ user: { coachMarksSeen: string[] } }>("/auth/me"),
    enabled: Boolean(session),
    staleTime: Infinity,
  });

  if (!screen) return null;
  const seen = me.data?.user.coachMarksSeen;
  // Derived, not set in an effect: the first visit opens it, and dismissing it closes it for good.
  const firstVisit = Boolean(seen && !seen.includes(screen)) && dismissed !== screen;
  const open = asked || firstVisit;

  const close = () => {
    setAsked(false);
    if (firstVisit) {
      setDismissed(screen);
      void http.post("/me/coach-marks", { screen }).then(() => me.refetch()).catch(() => undefined);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAsked(true)}
        aria-label={t("help.open")}
        className="-me-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <HelpCircle className="size-5" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }} title={t("help.title")}>
        <p className="text-[1.05rem] leading-relaxed">{t(`help.screens.${screen}` as StringKey)}</p>
        <Button size="lg" className="mt-5 w-full" onClick={close}>{t("help.gotIt")}</Button>
      </Sheet>
    </>
  );
}
