import { useEffect, useState, useCallback, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import { GuestPassBanner } from "@/components/GuestPassBanner";
import HomePage from "@/pages/HomePage";
import ArcadePage from "@/pages/ArcadePage";
import LabPage from "@/pages/LabPage";
import BossesPage from "@/pages/BossesPage";
import ProfilePage from "@/pages/ProfilePage";
import TeacherPage from "@/pages/TeacherPage";
import SafetyPage from "@/pages/SafetyPage";
import AuthPage from "@/pages/AuthPage";
import LobbyPage from "@/pages/LobbyPage";
import ShopPage from "@/pages/ShopPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import CommunityPage from "@/pages/CommunityPage";
import FeedbackPage from "@/pages/FeedbackPage";
import AdminPage from "@/pages/AdminPage";
import BadgesPage from "@/pages/BadgesPage";
import ClansPage from "@/pages/ClansPage";
import NewsPage from "@/pages/NewsPage";
import SettingsPage from "@/pages/SettingsPage";
import TeamsPage from "@/pages/TeamsPage";
import RebirthPage from "@/pages/RebirthPage";
import PotionsPage from "@/pages/PotionsPage";
import TournamentsPage from "@/pages/TournamentsPage";
import TradePage from "@/pages/TradePage";
import QuestsPage from "@/pages/QuestsPage";
import BrainBlitzPage from "@/pages/BrainBlitzPage";
import StoryPage from "@/pages/StoryPage";
import FriendsPage from "@/pages/FriendsPage";
import ClanBattlePage from "@/pages/ClanBattlePage";
import WorldsPage from "@/pages/WorldsPage";
import DimensionsPage from "@/pages/DimensionsPage";
import DecisionsPage from "@/pages/DecisionsPage";
import GrandTournamentPage from "@/pages/GrandTournamentPage";
import DistrictBattlesPage from "@/pages/DistrictBattlesPage";
import TournamentRankingsPage from "@/pages/TournamentRankingsPage";
import RedeemPage from "@/pages/RedeemPage";
import InvitePage from "@/pages/InvitePage";
import ClassesPage from "@/pages/ClassesPage";
import StreamPage from "@/pages/StreamPage";
import PartyPage from "@/pages/PartyPage";
import { AutoTranslate } from "@/lib/autoTranslate";
import { useLocalProgress } from "@/lib/useLocalProgress";
import { useAuth } from "@/hooks/use-auth";
import MouseFollower from "@/components/MouseFollower";
import ScreenDecorations from "@/components/ScreenDecorations";
import Tutorial from "@/components/Tutorial";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function GlobalMusicController({ isMuted }: { isMuted: boolean }) {
  const [location] = useLocation();
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [activeGame, setActiveGame] = useState<{ id?: string; category?: string } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMusic = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unlock = () => setAudioUnlocked(true);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const handleGameMusic = (event: Event) => {
      setActiveGame((event as CustomEvent<{ id?: string; category?: string } | null>).detail || null);
    };
    window.addEventListener("neuronix-game-music", handleGameMusic);
    return () => {
      window.removeEventListener("neuronix-game-music", handleGameMusic);
    };
  }, []);

  useEffect(() => {
    stopMusic();
    if (isMuted || !audioUnlocked) return;

    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = audioRef.current || new AudioCtor();
    audioRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume();

    const gameId = activeGame?.id || new URLSearchParams(window.location.search).get("game") || "";
    const category = (activeGame?.category || "").toLowerCase();
    const route = location.split("?")[0];
    const isArcadeAction = !!activeGame || route.startsWith("/arcade") || route.startsWith("/lobby") || route.startsWith("/worlds");
    const isBoss = route.startsWith("/bosses") || gameId.includes("boss") || route.startsWith("/grand-tournament") || route.startsWith("/district-battles") || route.startsWith("/clan-battles");
    const isLab = route.startsWith("/lab") || gameId.includes("lab") || category.includes("chemistry");
    const isTournament = route.startsWith("/tournaments") || route.startsWith("/tournament-rankings");
    const isSocial = route.startsWith("/clans") || route.startsWith("/teams") || route.startsWith("/community") || route.startsWith("/classes") || route.startsWith("/lobby") || route.startsWith("/invite");
    const isShop = route.startsWith("/shop") || route.startsWith("/potions") || route.startsWith("/trade") || route.startsWith("/rebirth") || route.startsWith("/profile") || route.startsWith("/redeem");
    const isHome = route === "/" || route === "/auth" || route === "/safety";
    const isLeaderboard = route.startsWith("/leaderboard") || route.startsWith("/badges");
    const isNews = route.startsWith("/news") || route.startsWith("/feedback");
    const isSettings = route.startsWith("/settings") || route.startsWith("/teacher");
    const isAdmin = route.startsWith("/admin");

    let preset = {
      notes: [196, 246.94, 293.66, 392, 293.66, 246.94],
      bass: [98, 123.47],
      stepMs: 820,
      wave: "sine" as OscillatorType,
      volume: 0.045,
      noteLength: 0.52,
    };

    if (isAdmin) {
      preset = { notes: [174.61, 220, 261.63, 349.23, 440, 349.23], bass: [87.31, 110], stepMs: 560, wave: "sawtooth", volume: 0.052, noteLength: 0.32 };
    } else if (isSettings) {
      preset = { notes: [220, 261.63, 329.63, 440, 329.63, 261.63], bass: [110, 130.81], stepMs: 860, wave: "sine", volume: 0.047, noteLength: 0.5 };
    } else if (isNews) {
      preset = { notes: [246.94, 293.66, 369.99, 493.88, 587.33, 493.88], bass: [123.47, 146.83], stepMs: 640, wave: "triangle", volume: 0.051, noteLength: 0.4 };
    } else if (isLeaderboard) {
      preset = { notes: [329.63, 392, 493.88, 659.25, 783.99, 659.25], bass: [164.81, 196], stepMs: 460, wave: "square", volume: 0.058, noteLength: 0.24 };
    } else if (isHome) {
      preset = { notes: [261.63, 329.63, 392, 523.25, 659.25, 523.25, 392, 329.63], bass: [130.81, 164.81, 196], stepMs: 700, wave: "triangle", volume: 0.06, noteLength: 0.42 };
    } else if (isBoss) {
      preset = { notes: [130.81, 196, 220, 261.63, 220, 196], bass: [65.41, 73.42], stepMs: 340, wave: "sawtooth", volume: 0.07, noteLength: 0.2 };
    } else if (isLab) {
      preset = { notes: [329.63, 392, 493.88, 659.25, 493.88, 392], bass: [164.81, 196], stepMs: 520, wave: "triangle", volume: 0.055, noteLength: 0.34 };
    } else if (isTournament) {
      preset = { notes: [261.63, 329.63, 392, 523.25, 587.33, 523.25], bass: [130.81, 196], stepMs: 380, wave: "square", volume: 0.062, noteLength: 0.24 };
    } else if (isSocial) {
      preset = { notes: [220, 277.18, 329.63, 440, 329.63, 277.18], bass: [110, 138.59], stepMs: 620, wave: "triangle", volume: 0.052, noteLength: 0.38 };
    } else if (isShop) {
      preset = { notes: [246.94, 311.13, 369.99, 493.88, 369.99, 311.13], bass: [123.47, 155.56], stepMs: 760, wave: "sine", volume: 0.05, noteLength: 0.46 };
    } else if (isArcadeAction) {
      if (category.includes("biology") || gameId.includes("bio") || gameId.includes("cell") || gameId.includes("dna")) {
        preset = { notes: [293.66, 349.23, 440, 587.33, 440, 349.23], bass: [146.83, 174.61], stepMs: 430, wave: "triangle", volume: 0.06, noteLength: 0.26 };
      } else if (category.includes("physics") || gameId.includes("gravity") || gameId.includes("physics") || gameId.includes("circuit")) {
        preset = { notes: [261.63, 392, 523.25, 659.25, 523.25, 392], bass: [130.81, 196], stepMs: 300, wave: "square", volume: 0.058, noteLength: 0.18 };
      } else if (category.includes("earth") || category.includes("space") || gameId.includes("planet") || gameId.includes("star") || gameId.includes("space")) {
        preset = { notes: [196, 293.66, 392, 587.33, 523.25, 392], bass: [98, 146.83], stepMs: 680, wave: "sine", volume: 0.056, noteLength: 0.44 };
      } else {
        preset = { notes: [261.63, 329.63, 392, 523.25, 392, 329.63], bass: [130.81, 164.81], stepMs: 380, wave: "square", volume: 0.06, noteLength: 0.22 };
      }
    }

    const master = ctx.createGain();
    master.gain.value = preset.volume;
    master.connect(ctx.destination);
    gainRef.current = master;
    let i = 0;

    const playNote = () => {
      if (!gainRef.current) return;
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = preset.wave;
      osc.frequency.value = preset.notes[i % preset.notes.length];
      noteGain.gain.setValueAtTime(0, ctx.currentTime);
      noteGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.025);
      noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + preset.noteLength);
      osc.connect(noteGain);
      noteGain.connect(gainRef.current);
      osc.start();
      osc.stop(ctx.currentTime + preset.noteLength + 0.02);

      if (i % 4 === 0) {
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = "sine";
        bass.frequency.value = preset.bass[Math.floor(i / 4) % preset.bass.length];
        bassGain.gain.setValueAtTime(0, ctx.currentTime);
        bassGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
        bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + Math.min(0.7, preset.noteLength * 2));
        bass.connect(bassGain);
        bassGain.connect(gainRef.current);
        bass.start();
        bass.stop(ctx.currentTime + Math.min(0.72, preset.noteLength * 2 + 0.04));
      }
      i++;
    };

    playNote();
    intervalRef.current = setInterval(playNote, preset.stepMs);
    return stopMusic;
  }, [activeGame, audioUnlocked, isMuted, location, stopMusic]);

  return null;
}

function Router() {
  const { user } = useAuth();
  const {
    progress, addXP, addCoins, earnBadge, defeatBoss, recordGamePlay,
    setAvatar, setYearLevel, toggleMute,
  } = useLocalProgress();

  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem("tutorial-done");
  });

  useEffect(() => {
    const handler = () => setShowTutorial(true);
    window.addEventListener("tutorial-reset", handler);
    return () => window.removeEventListener("tutorial-reset", handler);
  }, []);

  const completeTutorial = useCallback(() => {
    localStorage.setItem("tutorial-done", "1");
    setShowTutorial(false);
  }, []);

  if (!user) {
    return (
      <>
        <GlobalMusicController isMuted={progress.isMuted} />
        <Switch>
          <Route path="/auth" component={AuthPage} />
          <Route path="/safety" component={SafetyPage} />
          <Route>
            <AuthPage />
          </Route>
        </Switch>
      </>
    );
  }

  return (
    <>
      {showTutorial && <Tutorial onComplete={completeTutorial} />}
      <ScrollToTop />
      <MouseFollower />
      <ScreenDecorations />
      <GlobalMusicController isMuted={progress.isMuted} />
      <Navbar isMuted={progress.isMuted} onToggleMute={toggleMute} />
      <GuestPassBanner />
      <SuspendedOverlay />
      <div className="pt-14 md:pt-0 min-h-screen sidebar-content" id="main-content">
      <Switch>
        <Route path="/">
          <HomePage
            xp={progress.xp}
            level={progress.level}
            streak={progress.currentStreak}
            badges={progress.badges}
            totalGamesPlayed={progress.totalGamesPlayed}
          />
        </Route>
        <Route path="/arcade">
          <ArcadePage
            badges={progress.badges}
            onPlayGame={recordGamePlay}
            onAddXP={addXP}
            onEarnBadge={earnBadge}
            yearLevel={progress.yearLevel}
            onSetYearLevel={setYearLevel}
          />
        </Route>
        <Route path="/lobby" component={LobbyPage} />
        <Route path="/ranked" component={LobbyPage} />
        <Route path="/party" component={PartyPage} />
        <Route path="/stream" component={StreamPage} />
        <Route path="/lab">
          <LabPage onAddXP={addXP} onEarnBadge={earnBadge} />
        </Route>
        <Route path="/bosses">
          <BossesPage onAddXP={addXP} onAddCoins={addCoins} onEarnBadge={earnBadge} onDefeatBoss={defeatBoss} bossesDefeated={progress.bossesDefeated} yearLevel={progress.yearLevel} xp={progress.xp} badges={progress.badges} totalGamesPlayed={progress.totalGamesPlayed} />
        </Route>
        <Route path="/community" component={CommunityPage} />
        <Route path="/feedback" component={FeedbackPage} />
        {(user as any)?.isAdmin && <Route path="/admin" component={AdminPage} />}
        <Route path="/shop" component={ShopPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route path="/clans" component={ClansPage} />
        <Route path="/news" component={NewsPage} />
        <Route path="/badges" component={BadgesPage} />
        <Route path="/teams" component={TeamsPage} />
        <Route path="/tournaments" component={TournamentsPage} />
        <Route path="/rebirth" component={RebirthPage} />
        <Route path="/potions" component={PotionsPage} />
        <Route path="/trade" component={TradePage} />
        <Route path="/quests" component={QuestsPage} />
        <Route path="/brain-blitz">
          <BrainBlitzPage yearLevel={progress.yearLevel} onSetYearLevel={setYearLevel} />
        </Route>
        <Route path="/story" component={StoryPage} />
        <Route path="/friends" component={FriendsPage} />
        <Route path="/worlds" component={WorldsPage} />
        <Route path="/dimensions">
          <DimensionsPage
            onAddXP={addXP}
            onAddCoins={addCoins}
            onEarnBadge={earnBadge}
            yearLevel={progress.yearLevel}
            onSetYearLevel={setYearLevel}
            xp={progress.xp}
            badges={progress.badges}
          />
        </Route>
        <Route path="/clan-battles" component={ClanBattlePage} />
        <Route path="/grand-tournament" component={GrandTournamentPage} />
        <Route path="/district-battles" component={DistrictBattlesPage} />
        <Route path="/tournament-rankings" component={TournamentRankingsPage} />
        <Route path="/redeem" component={RedeemPage} />
        <Route path="/invite" component={InvitePage} />
        <Route path="/classes" component={ClassesPage} />
        <Route path="/settings">
          <SettingsPage isMuted={progress.isMuted} onToggleMute={toggleMute} />
        </Route>
        <Route path="/profile">
          <ProfilePage
            nickname={progress.nickname}
            avatarId={progress.avatarId}
            xp={progress.xp}
            level={progress.level}
            currentStreak={progress.currentStreak}
            longestStreak={progress.longestStreak}
            badges={progress.badges}
            totalGamesPlayed={progress.totalGamesPlayed}
            gameScores={progress.gameScores}
            inventory={(user as any)?.inventory || []}
            onSetAvatar={setAvatar}
            yearLevel={progress.yearLevel}
            onSetYearLevel={setYearLevel}
          />
        </Route>
        <Route path="/teacher">
          <TeacherPage
            nickname={progress.nickname}
            xp={progress.xp}
            level={progress.level}
            currentStreak={progress.currentStreak}
            longestStreak={progress.longestStreak}
            badges={progress.badges}
            totalGamesPlayed={progress.totalGamesPlayed}
            gameScores={progress.gameScores}
          />
        </Route>
        <Route path="/safety">
          <SafetyPage />
        </Route>
        <Route path="/decisions" component={DecisionsPage} />
        <Route path="/auth">
          <AuthPage />
        </Route>
        <Route component={NotFound} />
      </Switch>
      </div>
    </>
  );
}

function SuspendedOverlay() {
  const { user } = useAuth();
  const safety = ((user as any)?.safetySettings || {}) as Record<string, any>;
  if (!safety.suspended) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border-2 border-red-500/40 rounded-2xl p-7 text-center shadow-2xl">
        <div className="text-5xl mb-3">⏸️</div>
        <h2 className="text-2xl font-black mb-2">Account Paused</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Our anti-cheat noticed automated clicking on your account, so we've paused it for now.
          A grown-up moderator will take a look soon. You didn't lose any of your progress! 💜
        </p>
        {safety.suspendedReason && (
          <p className="text-xs font-semibold text-red-500 mb-4">Reason: {safety.suspendedReason}</p>
        )}
        <p className="text-xs text-muted-foreground">
          If you think this was a mistake, an admin can lift the pause from the Admin panel.
        </p>
      </div>
    </div>
  );
}

const ALL_THEME_CLASSES = [
  "theme-forest", "theme-ocean", "theme-fire", "theme-arctic",
  "theme-galaxy", "theme-rainbow", "theme-gold", "theme-jungle",
  "theme-volcanic", "reward-planet-theme", "reward-circuit-theme",
  "theme-clan-champion", "theme-team-champion", "theme-supreme-champion",
  "theme-ocean-depths", "theme-magma-core", "theme-frozen-tundra",
  "theme-jungle-canopy", "theme-space-station", "theme-crystal-caverns",
  "theme-storm-citadel", "theme-cyber-grid", "theme-dino-valley",
  "theme-quantum-realm", "theme-plain",
];

const SESSION_KEY = "nx_verified";

function SessionGuard() {
  const { user, logoutMutation } = useAuth();
  useEffect(() => {
    if (user && !sessionStorage.getItem(SESSION_KEY) && !logoutMutation.isPending) {
      logoutMutation.mutate();
    }
  }, [user, logoutMutation]);
  return null;
}

function DarkModeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);
  return null;
}

function ThemeApplier() {
  const { user } = useAuth();
  const equippedTheme = (user as any)?.equippedTheme;

  const getThemesEnabled = useCallback(() => {
    const stored = localStorage.getItem("cosmetic-themes");
    return stored !== null ? stored === "true" : true;
  }, []);

  const [themesEnabled, setThemesEnabled] = useState(getThemesEnabled);

  useEffect(() => {
    const handler = () => setThemesEnabled(getThemesEnabled());
    window.addEventListener("cosmetic-settings-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cosmetic-settings-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [getThemesEnabled]);

  useEffect(() => {
    const root = document.documentElement;
    ALL_THEME_CLASSES.forEach((cls) => root.classList.remove(cls));
    if (themesEnabled && equippedTheme && equippedTheme !== "default") {
      root.classList.add(equippedTheme);
    }
  }, [equippedTheme, themesEnabled]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <DarkModeInitializer />
          <SessionGuard />
          <ThemeApplier />
          <AutoTranslate />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
