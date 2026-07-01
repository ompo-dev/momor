/**
 * Premium Module Loader (trimmed).
 *
 * Momor is free — the ads / trial / upgrade / license modules were removed.
 * The only premium component still consumed is the NegotiationCoachingCard
 * (used by the meeting overlay). It is optionally loaded via Vite's glob from
 * an out-of-tree `premium/` folder; when absent (open-source build) it falls
 * back to a no-op so there are no build errors.
 */
import React from "react";

const NullComponent: React.FC<any> = () => null;

const _negotiationCard = import.meta.glob<any>(
  "../../premium/src/NegotiationCoachingCard.tsx",
  { eager: true },
);

function get<T>(mods: Record<string, any>, name: string, fallback: T): T {
  const mod = Object.values(mods)[0];
  return mod?.[name] ?? fallback;
}

export const NegotiationCoachingCard: React.FC<any> = get(
  _negotiationCard,
  "NegotiationCoachingCard",
  NullComponent,
);
