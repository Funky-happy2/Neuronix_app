export const PROFILE_ANIM_CLASSES: Record<string, string> = {
  "profile-anim-breathe":  "animate-profile-breathe",
  "profile-anim-glow":     "animate-profile-glow",
  "profile-anim-rainbow":  "animate-profile-rainbow",
  "profile-anim-fire":     "animate-profile-fire",
  "profile-anim-pulse":    "animate-profile-pulse",
  "profile-anim-cosmic":   "animate-profile-cosmic",
  "profile-anim-ice":      "animate-profile-ice",
  "profile-anim-electric": "animate-profile-electric",
  "profile-anim-shadow":   "animate-profile-shadow",
  "profile-anim-nova":     "animate-profile-nova",
};

export const NAME_ANIM_CLASSES: Record<string, string> = {
  "name-anim-blink":    "animate-name-blink",
  "name-anim-glow":     "animate-name-glow",
  "name-anim-rainbow":  "animate-name-rainbow",
  "name-anim-gold":     "animate-name-gold",
  "name-anim-fire":     "animate-name-fire",
  "name-anim-ice":      "animate-name-ice",
  "name-anim-electric": "animate-name-electric",
  "name-anim-cosmic":   "animate-name-cosmic",
  "name-anim-shadow":   "animate-name-shadow",
  "name-anim-plasma":   "animate-name-plasma",
};

export const FRAME_MINI_STYLES: Record<string, string> = {
  "frame-basic":             "ring-1 ring-gray-400",
  "frame-rounded":           "ring-2 ring-blue-400 rounded-2xl",
  "frame-science":           "ring-2 ring-emerald-400 ring-dashed animate-pulse-slow",
  "frame-fire":              "ring-[3px] ring-orange-500 animate-frame-fire",
  "frame-ice":               "ring-[3px] ring-cyan-400 animate-frame-ice",
  "frame-lightning":         "ring-[3px] ring-yellow-300 animate-frame-lightning",
  "frame-rainbow":           "ring-[3px] ring-pink-500 animate-frame-rainbow",
  "frame-galaxy":            "ring-[3px] ring-purple-500 animate-frame-galaxy rounded-xl",
  "frame-golden":            "ring-[4px] ring-double ring-amber-400 animate-frame-golden rounded-lg",
  "frame-void":              "ring-[3px] ring-violet-600 animate-frame-void rounded-sm",
  "frame-world-conqueror":   "ring-[3px] ring-emerald-500 animate-frame-conqueror",
  "frame-supreme-champion":  "ring-[4px] ring-yellow-400 animate-frame-supreme-champion",
  "frame-clan-champion":     "ring-[3px] ring-sky-400 animate-frame-clan-champion",
  "frame-team-champion":     "ring-[3px] ring-fuchsia-500 animate-frame-team-champion",
  "reward-tournament-frame": "ring-[3px] ring-yellow-400 animate-frame-golden",
};

export const TITLE_DISPLAY: Record<string, string> = {
  "title-curious":            "🔍 Curious",
  "title-explorer":           "🧭 Explorer",
  "title-champion":           "🏆 Champion",
  "title-legend":             "⭐ Legend",
  "title-professor":          "🎓 Professor",
  "title-mastermind":         "🧠 Mastermind",
  "title-world-conqueror":    "🌎 World Conqueror",
  "title-leaderboard-1st":    "👑 #1 Player",
  "title-elite-five":         "🌟 Elite Five",
  "title-ranked-grandmaster": "👑 Ranked Grandmaster",
  "title-clan-1st":           "🛡️ #1 Clan Leader",
  "title-team-1st":           "⚔️ #1 Team Captain",
  "title-admins-favourite":   "❤️ Admin's Favourite",
  "title-influencer":         "✨ Influencer",
  "title-my-clan":            "🛡️ Clan",
  "title-my-team":            "⚔️ Team",
  "reward-omega-title":       "⚡ Omega Slayer",
  "reward-speed-title":       "🔥 Speed Demon",
  "reward-tournament-title":  "🥇 Tournament Champion",
  "reward-clan-champion":     "🌍 Clan Champion",
};

export const TITLE_ANIMATION_CLASSES: Record<string, string> = {
  "title-leaderboard-1st":   "animate-title-shimmer",
  "title-elite-five":        "animate-title-gold",
  "title-ranked-grandmaster":"animate-title-fire",
  "title-admins-favourite":  "animate-title-shimmer",
  "title-influencer":        "animate-title-shimmer",
  "reward-omega-title":      "animate-title-shimmer",
  "title-clan-1st":          "animate-title-glow-blue",
  "title-my-clan":           "animate-title-glow-blue",
  "title-team-1st":          "animate-title-glow-purple",
  "title-my-team":           "animate-title-glow-purple",
  "title-mastermind":        "animate-title-glow",
  "title-professor":         "animate-title-glow",
  "title-legend":            "animate-title-glow",
  "reward-tournament-title": "animate-title-gold",
  "reward-clan-champion":    "animate-title-glow-blue",
  "reward-speed-title":      "animate-title-fire",
  "title-champion":          "animate-title-rainbow",
  "title-explorer":          "animate-title-ice",
  "title-curious":           "animate-title-pulse",
  "title-world-conqueror":   "animate-title-green",
};

export function getTitleAnimClass(titleId: string | undefined | null): string {
  if (!titleId || titleId === "default") return "";
  if (titleId.startsWith("custom:")) return "animate-title-glow";
  if (titleId.startsWith("admin-beater:")) return "animate-title-shimmer";
  return TITLE_ANIMATION_CLASSES[titleId] || "";
}

export function getTitle(titleId: string | undefined | null, clanTeamName?: string | null): string | null {
  if (!titleId || titleId === "default") return null;
  if (titleId.startsWith("custom:")) return titleId.slice(7) || null;
  if (titleId.startsWith("admin-beater:")) {
    const adminName = titleId.slice("admin-beater:".length);
    return `⚔️ ${adminName} Beater`;
  }
  if (titleId === "title-my-clan") return `🛡️ ${clanTeamName || "Clan"}`;
  if (titleId === "title-my-team") return `⚔️ ${clanTeamName || "Team"}`;
  if (TITLE_DISPLAY[titleId]) return TITLE_DISPLAY[titleId];
  return titleId
    .replace(/^(title-|reward-)/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
