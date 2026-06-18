import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Home, Gamepad2, FlaskConical, Swords, User, BookOpen, ShieldCheck,
  Volume2, VolumeX, Menu, X, LogOut, Users, UsersRound, ShoppingBag, Trophy, Coins, Globe, Gem,
  MessageCircle, Shield, Award, Sun, Moon, Settings, ChevronLeft, ChevronRight, Newspaper,
  Zap, Rocket, Bot, Sparkles, Wand2, Flame, Bird, Diamond, Star, RefreshCw, Beaker, Medal,
  Snowflake, Orbit, Crown, ArrowLeftRight, Skull, Map,
  Telescope, Mountain, Wind, Hexagon, Footprints, Cpu, Waves, TreePine, Atom,
  TrendingUp, GraduationCap, Calendar, Gift, Radio, Gavel,
  type LucideIcon
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSafety } from "@/hooks/use-safety";
import { getTitle, getTitleAnimClass, PROFILE_ANIM_CLASSES, NAME_ANIM_CLASSES, FRAME_MINI_STYLES } from "@/lib/titles";
import { useTranslation } from "@/lib/i18n";

const NAV_ITEMS = [
  { path: "/", label: "Home", tKey: "nav.home", icon: Home },
  { path: "/arcade", label: "Arcade", tKey: "nav.arcade", icon: Gamepad2 },
  { path: "/worlds", label: "Worlds", tKey: "nav.worlds", icon: Map },
  { path: "/dimensions", label: "Dimensions", tKey: "", icon: Hexagon },
  { path: "/lobby", label: "Multiplayer", tKey: "nav.lobby", icon: Users },
  { path: "/party", label: "Party", tKey: "", icon: UsersRound },
  { path: "/ranked", label: "Ranked", tKey: "nav.ranked", icon: Crown },
  { path: "/stream", label: "Live", tKey: "nav.live", icon: Radio },
  { path: "/lab", label: "Lab", tKey: "nav.lab", icon: FlaskConical },
  { path: "/bosses", label: "Bosses", tKey: "nav.bosses", icon: Swords },
  { path: "/community", label: "Community", tKey: "nav.community", icon: Globe },
  { path: "/shop", label: "Shop", tKey: "nav.shop", icon: ShoppingBag },
  { path: "/leaderboard", label: "Ranks", tKey: "nav.leaderboard", icon: Trophy },
  { path: "/clans", label: "Clans", tKey: "nav.clans", icon: Shield },
  { path: "/badges", label: "Badges", tKey: "nav.badges", icon: Award },
  { path: "/news", label: "News", tKey: "nav.news", icon: Newspaper },
  { path: "/teams", label: "Teams", tKey: "nav.teams", icon: UsersRound },
  { path: "/clan-battles", label: "Clan Wars", tKey: "", icon: Swords },
  { path: "/tournaments", label: "Tournaments", tKey: "nav.tournaments", icon: Medal },
  { path: "/grand-tournament", label: "Grand Tournament", tKey: "", icon: Trophy },
  { path: "/rebirth", label: "Rebirth", tKey: "nav.rebirth", icon: RefreshCw },
  { path: "/potions", label: "Potions", tKey: "nav.potions", icon: Beaker },
  { path: "/trade", label: "Trade", tKey: "nav.trade", icon: ArrowLeftRight },
  { path: "/friends", label: "Friends", tKey: "", icon: Users },
  { path: "/redeem", label: "Redeem", tKey: "", icon: Gift },
  { path: "/invite", label: "Invite", tKey: "", icon: Users },
  { path: "/classes", label: "Districts", tKey: "", icon: GraduationCap },
  { path: "/safety", label: "Safety", tKey: "", icon: ShieldCheck },
  { path: "/decisions", label: "Decisions", tKey: "", icon: Gavel },
  { path: "/feedback", label: "Feedback", tKey: "nav.feedback", icon: MessageCircle },
  { path: "/settings", label: "Settings", tKey: "nav.settings", icon: Settings },
];

const AVATAR_ICON_MAP: Record<string, { icon: LucideIcon; gradient: string }> = {
  "astronaut": { icon: Rocket, gradient: "from-blue-500 to-cyan-500" },
  "scientist": { icon: FlaskConical, gradient: "from-green-500 to-emerald-500" },
  "avatar-robot": { icon: Bot, gradient: "from-gray-500 to-slate-600" },
  "avatar-alien": { icon: Sparkles, gradient: "from-violet-500 to-purple-600" },
  "avatar-ninja": { icon: Swords, gradient: "from-red-500 to-rose-600" },
  "avatar-wizard": { icon: Wand2, gradient: "from-amber-500 to-yellow-600" },
  "avatar-dragon": { icon: Flame, gradient: "from-orange-500 to-red-600" },
  "avatar-phoenix": { icon: Bird, gradient: "from-pink-500 to-rose-600" },
  "avatar-crystal": { icon: Diamond, gradient: "from-cyan-500 to-teal-600" },
  "avatar-galaxy": { icon: Telescope, gradient: "from-purple-500 to-fuchsia-600" },
  "avatar-frost": { icon: Snowflake, gradient: "from-sky-400 to-blue-600" },
  "avatar-comet": { icon: Orbit, gradient: "from-amber-400 to-orange-600" },
  "reward-plague-mask": { icon: Skull, gradient: "from-lime-500 to-green-700" },
  "reward-element-crown": { icon: Crown, gradient: "from-yellow-400 to-amber-600" },
  "reward-all-bosses": { icon: Trophy, gradient: "from-red-600 to-rose-800" },
  "reward-nebula-crown": { icon: Moon, gradient: "from-indigo-500 to-purple-700" },
  "avatar-kraken": { icon: Waves, gradient: "from-blue-600 to-cyan-800" },
  "avatar-magma-titan": { icon: Mountain, gradient: "from-red-600 to-orange-800" },
  "avatar-frost-wyrm": { icon: Wind, gradient: "from-cyan-400 to-blue-700" },
  "avatar-jungle-hydra": { icon: TreePine, gradient: "from-green-500 to-emerald-700" },
  "avatar-cosmic-entity": { icon: Sun, gradient: "from-amber-400 to-yellow-600" },
  "avatar-crystal-golem": { icon: Hexagon, gradient: "from-pink-400 to-purple-600" },
  "avatar-thunder-king": { icon: Zap, gradient: "from-yellow-400 to-amber-600" },
  "avatar-virus-prime": { icon: Cpu, gradient: "from-green-500 to-teal-700" },
  "avatar-rex-overlord": { icon: Footprints, gradient: "from-amber-500 to-orange-700" },
  "avatar-quantum-phantom": { icon: Atom, gradient: "from-violet-500 to-indigo-700" },
  "avatar-xp-rising": { icon: TrendingUp, gradient: "from-emerald-400 to-green-600" },
  "avatar-xp-veteran": { icon: GraduationCap, gradient: "from-blue-400 to-indigo-600" },
  "avatar-xp-master": { icon: Award, gradient: "from-purple-400 to-violet-600" },
  "avatar-xp-legend": { icon: Star, gradient: "from-yellow-400 to-amber-600" },
  "avatar-streak-master": { icon: Calendar, gradient: "from-orange-400 to-red-600" },
  "avatar-game-master": { icon: Gamepad2, gradient: "from-blue-500 to-purple-600" },
  "avatar-rebirth-phoenix": { icon: RefreshCw, gradient: "from-rose-400 to-pink-600" },
  "avatar-rebirth-titan": { icon: Shield, gradient: "from-slate-400 to-gray-700" },
  "avatar-news-star": { icon: Newspaper, gradient: "from-yellow-400 to-amber-500" },
  "avatar-viral-scientist": { icon: Sparkles, gradient: "from-violet-500 to-purple-600" },
  "avatar-infinity": { icon: Gem, gradient: "from-fuchsia-500 via-purple-600 to-amber-500" },
  "avatar-elemental-lord": { icon: Flame, gradient: "from-orange-500 via-amber-500 to-teal-500" },
  "avatar-cosmos-sovereign": { icon: Telescope, gradient: "from-indigo-500 via-violet-500 to-sky-400" },
  "reward-tournament-avatar": { icon: Medal, gradient: "from-yellow-400 to-orange-600" },
  "avatar-clan-champion": { icon: Globe, gradient: "from-blue-500 to-slate-700" },
  "avatar-team-champion": { icon: Users, gradient: "from-purple-500 to-violet-700" },
  "avatar-supreme-champion": { icon: Gem, gradient: "from-yellow-400 to-orange-600" },
};

const COIN_STYLE_COLORS: Record<string, { icon: string; text: string; anim?: string }> = {
  "coin-style-diamond": { icon: "text-cyan-400 drop-shadow-sm", text: "text-cyan-500 dark:text-cyan-400", anim: "animate-coin-sparkle" },
  "coin-style-fire": { icon: "text-orange-500 drop-shadow-sm", text: "text-orange-600 dark:text-orange-400", anim: "animate-coin-flame" },
  "coin-style-ice": { icon: "text-sky-400 drop-shadow-sm", text: "text-sky-500 dark:text-sky-400", anim: "animate-coin-frost" },
  "coin-style-rainbow": { icon: "text-pink-500 drop-shadow-sm", text: "text-pink-600 dark:text-pink-400", anim: "animate-coin-rainbow" },
  "coin-style-plasma": { icon: "text-fuchsia-500 drop-shadow-sm", text: "text-fuchsia-600 dark:text-fuchsia-400", anim: "animate-coin-pulse" },
  "coin-style-void": { icon: "text-zinc-500 drop-shadow-sm", text: "text-zinc-600 dark:text-zinc-400", anim: "animate-coin-void" },
  "coin-style-champion": { icon: "text-amber-500 drop-shadow-sm", text: "text-amber-600 dark:text-amber-400", anim: "animate-coin-sparkle" },
  "coin-style-toxic": { icon: "text-lime-500 drop-shadow-sm", text: "text-lime-600 dark:text-lime-400", anim: "animate-coin-toxic" },
  "coin-style-nebula": { icon: "text-indigo-600 drop-shadow-sm", text: "text-indigo-700 dark:text-indigo-400", anim: "animate-coin-pulse" },
  "coin-style-supreme-champion": { icon: "text-yellow-400 drop-shadow-sm", text: "text-yellow-500 dark:text-yellow-300", anim: "animate-coin-sparkle" },
  "coin-style-clan-champion": { icon: "text-sky-400 drop-shadow-sm", text: "text-sky-500 dark:text-sky-400", anim: "animate-coin-frost" },
  "coin-style-team-champion": { icon: "text-fuchsia-500 drop-shadow-sm", text: "text-fuchsia-600 dark:text-fuchsia-400", anim: "animate-coin-pulse" },
};

const GEM_STYLE_COLORS: Record<string, { icon: string; text: string; anim?: string }> = {
  "gem-style-emerald": { icon: "text-emerald-500 drop-shadow-sm", text: "text-emerald-600 dark:text-emerald-400", anim: "animate-gem-glow" },
  "gem-style-ruby": { icon: "text-rose-500 drop-shadow-sm", text: "text-rose-600 dark:text-rose-400", anim: "animate-gem-pulse" },
  "gem-style-sapphire": { icon: "text-blue-500 drop-shadow-sm", text: "text-blue-600 dark:text-blue-400", anim: "animate-gem-shimmer" },
  "gem-style-cosmic": { icon: "text-fuchsia-500 drop-shadow-sm", text: "text-fuchsia-600 dark:text-fuchsia-400", anim: "animate-gem-cosmic" },
  "gem-style-lightning": { icon: "text-yellow-300 drop-shadow-sm", text: "text-yellow-400 dark:text-yellow-300", anim: "animate-gem-flash" },
  "gem-style-void": { icon: "text-purple-900 drop-shadow-sm", text: "text-purple-950 dark:text-purple-400", anim: "animate-gem-void" },
  "gem-style-champion": { icon: "text-orange-400 drop-shadow-sm", text: "text-orange-500 dark:text-orange-300", anim: "animate-gem-sparkle" },
  "gem-style-frost": { icon: "text-teal-400 drop-shadow-sm", text: "text-teal-500 dark:text-teal-400", anim: "animate-gem-frost" },
  "gem-style-magma": { icon: "text-red-700 drop-shadow-sm", text: "text-red-800 dark:text-red-500", anim: "animate-gem-magma" },
  "gem-style-supreme-champion": { icon: "text-yellow-400 drop-shadow-sm", text: "text-yellow-500 dark:text-yellow-300", anim: "animate-gem-sparkle" },
  "gem-style-clan-champion": { icon: "text-sky-400 drop-shadow-sm", text: "text-sky-500 dark:text-sky-400", anim: "animate-gem-shimmer" },
  "gem-style-team-champion": { icon: "text-fuchsia-500 drop-shadow-sm", text: "text-fuchsia-600 dark:text-fuchsia-400", anim: "animate-gem-cosmic" },
};


interface NavbarProps {
  isMuted: boolean;
  onToggleMute: () => void;
}

function computeLevel(xp: number): number {
  // Closed-form inverse of the XP curve. Returns the correct level for ANY xp
  // (the old loop returned 1 once xp passed the level-100 threshold).
  if (typeof xp !== "number" || isNaN(xp) || xp <= 0) return 1;
  return Math.max(1, Math.floor((125 + Math.sqrt(625 + 300 * xp)) / 150));
}

function getLevelXpRange(level: number): { start: number; end: number } {
  let cumulative = 0;
  for (let l = 1; l < level; l++) {
    cumulative += l * 100 + (l - 1) * 50;
  }
  const start = cumulative;
  const end = cumulative + level * 100 + (level - 1) * 50;
  return { start, end };
}

export default function Navbar({ isMuted, onToggleMute }: NavbarProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const { user, logoutMutation } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "4rem" : "13rem");
  }, [collapsed]);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "4rem" : "13rem");
  }, []);

  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  }, [location]);

  const userCoins = (user as any)?.coins || 0;
  const userGems = (user as any)?.gems || 0;
  const equippedCoinStyle = (user as any)?.equippedCosmetics?.coin_style || "";
  const equippedGemStyle = (user as any)?.equippedCosmetics?.gem_style || "";
  const equippedFrame = (user as any)?.equippedCosmetics?.frame || "";
  const equippedProfileAnim = (user as any)?.equippedCosmetics?.profile_animation || "";
  const equippedNameAnim = (user as any)?.equippedCosmetics?.name_animation || "";
  const profileAnimClass = PROFILE_ANIM_CLASSES[equippedProfileAnim] || "";
  const nameAnimClass = NAME_ANIM_CLASSES[equippedNameAnim] || "";
  const coinColors = COIN_STYLE_COLORS[equippedCoinStyle];
  const gemColors = GEM_STYLE_COLORS[equippedGemStyle];
  const coinIconClass = coinColors?.icon || "text-yellow-600 dark:text-yellow-400 drop-shadow-sm";
  const coinAnimClass = coinColors?.anim || "";
  const gemIconClass = gemColors?.icon || "text-orange-500 dark:text-orange-400 drop-shadow-sm";
  const gemAnimClass = gemColors?.anim || "";
  const userXp = (user as any)?.xp || 0;
  const userLevel = (user as any)?.level || computeLevel(userXp);
  const username = (user as any)?.username || "";
  const avatarId = (user as any)?.avatarId || "astronaut";
  const { start: lvlStart, end: lvlEnd } = getLevelXpRange(userLevel);
  const xpInLevel = userXp - lvlStart;
  const xpNeeded = lvlEnd - lvlStart;
  const xpPercent = xpNeeded > 0 ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 0;

  const avatarInfo = AVATAR_ICON_MAP[avatarId] || AVATAR_ICON_MAP["astronaut"];
  const AvatarIcon = avatarInfo.icon;
  const { hiddenPaths } = useSafety();
  const visibleNavItems = NAV_ITEMS.filter(item => !hiddenPaths.has(item.path));

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="fixed top-0 left-0 z-50 md:hidden flex items-center gap-2 h-14 px-3 bg-background/95 backdrop-blur-sm border-b border-border w-full">
        <Button size="icon" variant="ghost" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <Link href="/" data-testid="link-home-logo-mobile">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-base font-bold bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
              Neuronix
            </h1>
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {user && (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="font-bold text-[10px] gap-0.5 px-1.5 py-0.5 border border-border/50">
                <Coins className={`w-3 h-3 ${coinIconClass} ${coinAnimClass}`} /> {userCoins.toLocaleString()}
              </Badge>
              <Badge variant="secondary" className="font-bold text-[10px] gap-0.5 px-1.5 py-0.5 border border-border/50">
                <Gem className={`w-3 h-3 ${gemIconClass} ${gemAnimClass}`} /> {userGems.toLocaleString()}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <aside className={`fixed top-0 left-0 z-50 h-full bg-background border-r border-border flex flex-col transition-all duration-300 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 ${collapsed ? "md:w-16" : "md:w-52"}`}
        data-testid="sidebar"
      >
        <div className={`flex items-center h-14 border-b border-border shrink-0 ${collapsed ? "justify-center px-2" : "px-3 gap-2"}`}>
          <Link href="/" data-testid="link-home-logo">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className={`${collapsed ? "w-9 h-9" : "w-8 h-8"} rounded-md bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0`}>
                <Gamepad2 className={`${collapsed ? "w-5 h-5" : "w-4 h-4"} text-white`} />
              </div>
              {!collapsed && (
                <div>
                  <h1 className="text-sm font-bold leading-tight bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
                    Neuronix
                  </h1>
                </div>
              )}
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {visibleNavItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  data-testid={`link-nav-${item.label.toLowerCase()}`}
                  className={`w-full font-semibold text-xs ${collapsed ? "justify-center px-0" : "justify-start gap-2"}`}
                  title={collapsed ? (item.tKey ? t(item.tKey) : item.label) : undefined}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && (item.tKey ? t(item.tKey) : item.label)}
                </Button>
              </Link>
            );
          })}
          {(user as any)?.isAdmin && (
            <Link href="/admin">
              <Button
                variant={location === "/admin" ? "secondary" : "ghost"}
                size="sm"
                className={`w-full font-semibold text-xs text-red-500 ${collapsed ? "justify-center px-0" : "justify-start gap-2"}`}
                data-testid="link-nav-admin"
                title={collapsed ? "Admin" : undefined}
              >
                <Shield className="w-4 h-4 shrink-0" />
                {!collapsed && "Admin"}
              </Button>
            </Link>
          )}
        </nav>

        <div className="border-t border-border shrink-0">
          {user && (
            <Link href="/profile">
              <div className={`cursor-pointer hover:bg-muted/50 transition-colors ${collapsed ? "p-2 flex justify-center" : "px-3 py-2"}`} data-testid="link-nav-profile">
                {collapsed ? (
                  <div className={`w-8 h-8 rounded-full overflow-hidden ${FRAME_MINI_STYLES[equippedFrame] || ""}`} title={username}>
                    <div className={`w-full h-full rounded-full bg-gradient-to-br ${avatarInfo.gradient} flex items-center justify-center ${profileAnimClass}`}>
                      <AvatarIcon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full shrink-0 overflow-hidden ${FRAME_MINI_STYLES[equippedFrame] || ""}`}>
                      <div className={`w-full h-full rounded-full bg-gradient-to-br ${avatarInfo.gradient} flex items-center justify-center ${profileAnimClass}`}>
                        <AvatarIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-[11px] font-bold truncate ${nameAnimClass}`} data-testid="text-sidebar-username">{username}</p>
                        <span className="text-[9px] font-bold text-muted-foreground">Lv.{userLevel}</span>
                        {(user as any)?.isVip && (
                          <Badge className="text-[8px] font-black px-1 py-0 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 leading-tight" data-testid="vip-badge-sidebar">
                            ✦ VIP
                          </Badge>
                        )}
                      </div>
                      {(() => {
                        const equippedTitle = (user as any)?.equippedCosmetics?.title;
                        const clanTeamName = equippedTitle === "title-my-clan" ? (user as any)?.clanName : equippedTitle === "title-my-team" ? (user as any)?.teamName : undefined;
                        const titleText = getTitle(equippedTitle, clanTeamName);
                        if (!titleText) return null;
                        return (
                          <Badge variant="secondary" className={`mt-0.5 text-[8px] font-bold px-1.5 py-0 ${getTitleAnimClass(equippedTitle)}`} data-testid="text-sidebar-title">
                            {titleText}
                          </Badge>
                        );
                      })()}
                      <Progress value={xpPercent} className="h-1 mt-0.5" />
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground">
                          <Coins className={`w-2.5 h-2.5 ${coinIconClass} ${coinAnimClass}`} />{userCoins.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground">
                          <Gem className={`w-2.5 h-2.5 ${gemIconClass} ${gemAnimClass}`} />{userGems.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )}

          <div className="px-2 pb-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className={`w-full text-xs hidden md:flex ${collapsed ? "justify-center px-0" : "justify-start gap-2"}`}
              data-testid="button-collapse-sidebar"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
              {!collapsed && "Collapse"}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
