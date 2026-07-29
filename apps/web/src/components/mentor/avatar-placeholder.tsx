function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic hue from the name so the same person always gets the same
 * color, with no server round trip. */
function hueFrom(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/** No uploads this milestone — a deterministic initials circle stands in
 * for a real avatar image, for both the Mentor Profile and anywhere a
 * mentor/student's identity needs a small visual anchor. */
export function AvatarPlaceholder({ name, size = 40 }: { name: string; size?: number }) {
  const hue = hueFrom(name);
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        backgroundColor: `hsl(${hue} 45% 38%)`,
      }}
    >
      {initialsFrom(name)}
    </div>
  );
}
