/**
 * The one personal field on a person's row (§11 `User.avatar`): optional, square, downscaled here
 * on the device and only then sent (§6.11.1). A photograph exists because a shared till is a list
 * of names tapped twice a day in bad light, and a face is faster to find than a word.
 */
import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared";
import { Button } from "@/components/ui/button.tsx";
import { problemMessage, t } from "@/i18n/t.ts";
import { ApiProblem, http } from "@/lib/http.ts";
import { squareAvatarDataUrl } from "@/lib/image.ts";

export interface AvatarFieldProps {
  userId: string;
  name: string;
  avatarUpdatedAt: string | null;
  onChange: (avatarUpdatedAt: string | null) => void;
}

export function AvatarField({ userId, name, avatarUpdatedAt, onChange }: AvatarFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const image = await squareAvatarDataUrl(file);
      const res = await http.put<{ avatarUpdatedAt: string }>(`/users/${userId}/avatar`, { image });
      onChange(res.avatarUpdatedAt);
      toast.success(t("staff.photoSaved"));
    } catch (err) {
      if (err instanceof ApiProblem) toast.error(problemMessage(err.type));
      else if (err instanceof Error && err.message === "image-too-large") toast.error(t("staff.photoTooLarge"));
      else toast.error(t("staff.photoUnreadable"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await http.del<{ avatarUpdatedAt: null }>(`/users/${userId}/avatar`);
      onChange(null);
      toast.success(t("staff.photoRemoved"));
    } catch (err) {
      toast.error(problemMessage(err instanceof ApiProblem ? err.type : "network"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar name={name} userId={userId} avatarUpdatedAt={avatarUpdatedAt} className="size-20 text-3xl" />
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {/* The real control, kept off screen: a file input cannot be styled to 48 px reliably. */}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <Button variant="soft" disabled={busy} onClick={() => input.current?.click()}>
          <ImageUp />
          {avatarUpdatedAt ? t("staff.photoReplace") : t("staff.photoAdd")}
        </Button>
        {avatarUpdatedAt && (
          <Button variant="ghost" disabled={busy} onClick={() => void remove()}>
            <Trash2 />
            {t("staff.photoRemove")}
          </Button>
        )}
        <p className="w-full text-sm text-muted-foreground">{t("staff.photoHint")}</p>
      </div>
    </div>
  );
}
