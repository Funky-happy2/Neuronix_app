import { useAuth } from "@/hooks/use-auth";

export const SAFETY_KEYS = [
  "hideLeaderboard",
  "disableMultiplayer",
  "hideTrade",
  "hideCommunityPacks",
  "hideNews",
  "hideClans",
  "focusMode",
] as const;

export type SafetyKey = typeof SAFETY_KEYS[number];

export const SAFETY_LABELS: Record<SafetyKey, { label: string; description: string }> = {
  hideLeaderboard: {
    label: "Hide Leaderboard",
    description: "Remove the public rankings board so you focus on your own progress.",
  },
  disableMultiplayer: {
    label: "Disable Multiplayer",
    description: "Turn off multiplayer lobby and 1v1 battles.",
  },
  hideTrade: {
    label: "Disable Trading",
    description: "Remove the player-to-player trading feature.",
  },
  hideCommunityPacks: {
    label: "Hide Community Packs",
    description: "Hide the community question hub (content created by other players).",
  },
  hideNews: {
    label: "Hide News & Messages",
    description: "Remove the news feed and announcements from the home screen.",
  },
  hideClans: {
    label: "Hide Clans & Clan Wars",
    description: "Remove clan features and clan battle pages.",
  },
  focusMode: {
    label: "Focus Mode",
    description: "Show only Arcade, Worlds, Lab, Bosses — hides all social features at once.",
  },
};

export const SAFETY_DEFAULTS: Record<SafetyKey, boolean> = {
  hideLeaderboard: false,
  disableMultiplayer: false,
  hideTrade: false,
  hideCommunityPacks: false,
  hideNews: false,
  hideClans: false,
  focusMode: false,
};

export function useSafety() {
  const { user } = useAuth();
  const personal = ((user as any)?.safetySettings || {}) as Partial<Record<SafetyKey, boolean>>;
  const classSafe = ((user as any)?.classSafetySettings || {}) as Partial<Record<SafetyKey, boolean>> & {
    locked?: string[];
  };
  const locked: string[] = classSafe.locked || [];

  const effective = { ...SAFETY_DEFAULTS, ...personal };

  for (const key of SAFETY_KEYS) {
    if (classSafe[key] !== undefined) {
      effective[key] = classSafe[key] as boolean;
    }
  }

  if (effective.focusMode) {
    effective.hideLeaderboard = true;
    effective.disableMultiplayer = true;
    effective.hideTrade = true;
    effective.hideCommunityPacks = true;
    effective.hideNews = true;
    effective.hideClans = true;
  }

  const isLocked = (key: SafetyKey) => locked.includes(key);

  const hiddenPaths = new Set<string>();
  if (effective.hideLeaderboard) hiddenPaths.add("/leaderboard");
  if (effective.disableMultiplayer) { hiddenPaths.add("/lobby"); hiddenPaths.add("/pvp"); }
  if (effective.hideTrade) hiddenPaths.add("/trade");
  if (effective.hideCommunityPacks) hiddenPaths.add("/community");
  if (effective.hideNews) hiddenPaths.add("/news");
  if (effective.hideClans) { hiddenPaths.add("/clans"); hiddenPaths.add("/clan-battles"); }
  if (effective.focusMode) {
    ["/teams", "/tournaments", "/grand-tournament", "/rebirth", "/potions", "/invite", "/redeem"].forEach(p => hiddenPaths.add(p));
  }

  return { effective, isLocked, hiddenPaths, locked, classSafe };
}
