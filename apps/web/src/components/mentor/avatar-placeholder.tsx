function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** No uploads this milestone — a deterministic initials circle stands in
 * for a real avatar image, for both the Mentor Profile and anywhere a
 * mentor/student's identity needs a small visual anchor. Neutral surface +
 * ink text, not a per-person hue — a roster of these should read as one
 * calm, monochrome list, not a wall of random accent colors (the brand's
 * "grey/white/neutral majority, accent sparingly" rule applies here too). */
export function AvatarPlaceholder({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-semibold text-foreground"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {initialsFrom(name)}
    </div>
  );
}
