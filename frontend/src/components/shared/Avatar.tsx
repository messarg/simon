/**
 * A person, as a square tile: their photograph when there is one, otherwise the first letter of
 * their name — which is what every screen showed before photographs existed and what every screen
 * still shows for someone who has none (§6.11.1).
 *
 * The image is fetched by `<img src>` rather than through the HTTP client, so it carries no
 * Authorization header: `GET /users/:id/avatar` draws the sign-in tiles and is necessarily
 * reachable before anyone has signed in (§15.4, §26.2). A missing or broken photograph falls back
 * to the initial instead of leaving a hole.
 *
 * It is `aria-hidden` by default: it sits beside the name everywhere it is used, and a screen
 * reader that announces both reads the person's name twice.
 *
 * **`rounded-full` here is deliberate, and is rounder than the step scale the rest of
 * this interface keeps.** A face is a face wherever it appears — the sign-in tiles, the staff list,
 * a person's page — and a circle is what reads as *a person* rather than as another card in a
 * screen full of cards. It also crops to the middle of the photograph, which is where the face is.
 * Squaring it off would make the tiles indistinguishable from the tiles around them, so a later
 * design audit should leave this alone rather than "fix" it. Nothing else in the app is round.
 */
import { useState } from "react";
import { cn } from "@/lib/cn.ts";

export interface AvatarProps {
  name: string;
  /** Absent for a person who does not exist yet — the editor before the first save. */
  userId?: string;
  /** When the photograph was last written. Null or absent means there is none. */
  avatarUpdatedAt?: string | null;
  className?: string;
}

/** Cache-busted on the timestamp, so a replaced photograph is not the old one from disk. */
const avatarUrl = (userId: string, version: string) =>
  `/api/users/${encodeURIComponent(userId)}/avatar?v=${encodeURIComponent(version)}`;

export function Avatar({ name, userId, avatarUpdatedAt, className }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const version = userId && avatarUpdatedAt && failed !== avatarUpdatedAt ? avatarUpdatedAt : null;

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-semibold text-accent-foreground",
        className,
      )}
    >
      {userId && version ? (
        <img src={avatarUrl(userId, version)} alt="" width={256} height={256} className="size-full rounded-full object-cover" onError={() => setFailed(version)} />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
