/**
 * Camera scanning (§18). Needs a secure context — on plain HTTP the browser refuses silently,
 * so say so plainly and point to the scanner and search. The camera stops when the sheet closes.
 */
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet.tsx";
import { t } from "@/i18n/t.ts";

export function CameraSheet({ open, onOpenChange, onScan }: { open: boolean; onOpenChange: (o: boolean) => void; onScan: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const available = typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (!open || !available) return;
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    void import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      if (cancelled || !video.current) return;
      try {
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current, (result) => {
          if (result) { controls?.stop(); onScan(result.getText()); onOpenChange(false); }
        });
      } catch {
        setFailed(true);
      }
    });
    return () => { cancelled = true; controls?.stop(); };
  }, [open, available, onScan, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("till.cameraTitle")}>
      {!available || failed ? (
        <p className="rounded-lg bg-attention-soft p-4 text-attention-foreground">{t("till.cameraUnavailable")}</p>
      ) : (
        <div>
          <video ref={video} className="aspect-[4/3] w-full rounded-lg bg-foreground object-cover" muted playsInline />
          <p className="mt-2 text-center text-sm text-muted-foreground">{t("till.cameraHint")}</p>
        </div>
      )}
    </Sheet>
  );
}
