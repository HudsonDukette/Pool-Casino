import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const cache = new Map<string, string>();

/** Resolves a stored avatar path (or absolute URL) into a displayable URL. */
export function useAvatarUrl(path: string | null | undefined) {
  const [url, setUrl] = React.useState<string | null>(() =>
    path ? (path.startsWith("http") ? path : (cache.get(path) ?? null)) : null,
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith("http")) {
      setUrl(path);
      return;
    }
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        cache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

export function PlayerAvatar({
  username,
  avatarUrl,
  className,
}: {
  username: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const url = useAvatarUrl(avatarUrl);
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center",
        className ?? "w-12 h-12",
      )}
    >
      {url ? (
        <img
          src={url}
          alt={`${username} profile picture`}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-display font-bold text-white/90">
          {username.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
