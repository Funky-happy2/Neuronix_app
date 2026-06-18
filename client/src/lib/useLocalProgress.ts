import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LocalProgress {
  nickname: string;
  avatarId: string;
  xp: number;
  coins: number;
  gems: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayDate: string | null;
  badges: string[];
  gameScores: Record<string, number>;
  totalGamesPlayed: number;
  isMuted: boolean;
  bossesDefeated: Record<string, number>;
  yearLevel: number;
}

const DEFAULT_PROGRESS: LocalProgress = {
  nickname: "Player",
  avatarId: "astronaut",
  xp: 0,
  coins: 0,
  gems: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastPlayDate: null,
  badges: [],
  gameScores: {},
  totalGamesPlayed: 0,
  isMuted: false,
  bossesDefeated: {},
  yearLevel: 7,
};

function computeLevel(xp: number): number {
  // Closed-form inverse of the XP curve — correct for ANY xp (matches the server).
  if (typeof xp !== "number" || isNaN(xp) || xp <= 0) return 1;
  return Math.max(1, Math.floor((125 + Math.sqrt(625 + 300 * xp)) / 150));
}

export function useLocalProgress() {
  const { user } = useAuth();

  const progressFromUser = useCallback((): LocalProgress => {
    if (!user) return { ...DEFAULT_PROGRESS };
    return {
      nickname: (user as any).displayName || user.username,
      avatarId: user.avatarId,
      xp: user.xp,
      coins: user.coins,
      gems: (user as any).gems ?? 0,
      level: user.level,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      lastPlayDate: user.lastPlayDate ?? null,
      badges: user.badges ?? [],
      gameScores: (user.gameScores as Record<string, number>) ?? {},
      totalGamesPlayed: user.totalGamesPlayed,
      isMuted: user.isMuted,
      bossesDefeated: (user.bossesDefeated as Record<string, number>) ?? {},
      yearLevel: user.yearLevel ?? 7,
    };
  }, [user]);

  const [progress, setProgress] = useState<LocalProgress>(progressFromUser);

  useEffect(() => {
    setProgress(progressFromUser());
  }, [user, progressFromUser]);

  const syncToServer = useCallback(async (updates: Partial<any>) => {
    try {
      await apiRequest("PATCH", "/api/user/progress", updates);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch {}
  }, []);

  const addXP = useCallback((amount: number) => {
    setProgress((prev) => {
      const newXP = prev.xp + amount;
      const newLevel = computeLevel(newXP);
      syncToServer({ xp: newXP, level: newLevel });
      return { ...prev, xp: newXP, level: newLevel };
    });
  }, [syncToServer]);

  const addCoins = useCallback((amount: number) => {
    setProgress((prev) => {
      const newCoins = prev.coins + amount;
      syncToServer({ coins: newCoins });
      return { ...prev, coins: newCoins };
    });
  }, [syncToServer]);

  const earnBadge = useCallback((badgeId: string) => {
    const serverBadges: string[] = (user as any)?.badges ?? [];
    if (serverBadges.includes(badgeId)) {
      setProgress((prev) => {
        if (prev.badges.includes(badgeId)) return prev;
        return { ...prev, badges: [...prev.badges, badgeId] };
      });
      return;
    }
    const newBadges = [...serverBadges, badgeId];
    syncToServer({ badges: newBadges });
    setProgress((prev) => ({ ...prev, badges: newBadges }));
  }, [syncToServer, user]);

  const recordGamePlay = useCallback((gameId: string, score: number) => {
    setProgress((prev) => {
      const today = new Date().toISOString().split("T")[0];
      const lastDate = prev.lastPlayDate;
      let streak = prev.currentStreak;
      let longest = prev.longestStreak;

      if (lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split("T")[0];
        streak = lastDate === yStr ? streak + 1 : 1;
        longest = Math.max(longest, streak);
      }

      const existingScore = (prev.gameScores[gameId] as number) || 0;
      const newScores = { ...prev.gameScores, [gameId]: Math.max(existingScore, score) };
      const newTotal = prev.totalGamesPlayed + 1;

      syncToServer({
        gameScores: newScores,
        totalGamesPlayed: newTotal,
        lastPlayDate: today,
        currentStreak: streak,
        longestStreak: longest,
      });

      return {
        ...prev,
        gameScores: newScores,
        totalGamesPlayed: newTotal,
        lastPlayDate: today,
        currentStreak: streak,
        longestStreak: longest,
      };
    });
  }, [syncToServer]);

  const setNickname = useCallback((_name: string) => {
  }, []);

  const setAvatar = useCallback((avatarId: string) => {
    setProgress((prev) => ({ ...prev, avatarId }));
    syncToServer({ avatarId });
  }, [syncToServer]);

  const toggleMute = useCallback(() => {
    setProgress((prev) => {
      const newMuted = !prev.isMuted;
      syncToServer({ isMuted: newMuted });
      return { ...prev, isMuted: newMuted };
    });
  }, [syncToServer]);

  const setYearLevel = useCallback((yearLevel: number) => {
    setProgress((prev) => ({ ...prev, yearLevel }));
    syncToServer({ yearLevel });
  }, [syncToServer]);

  const defeatBoss = useCallback((bossId: string) => {
    setProgress((prev) => {
      const count = (prev.bossesDefeated[bossId] || 0) + 1;
      const newBossesDefeated = { ...prev.bossesDefeated, [bossId]: count };
      syncToServer({ bossesDefeated: newBossesDefeated });
      return { ...prev, bossesDefeated: newBossesDefeated };
    });
  }, [syncToServer]);

  const resetProgress = useCallback(() => {
    setProgress({ ...DEFAULT_PROGRESS });
  }, []);

  return {
    progress,
    addXP,
    addCoins,
    earnBadge,
    defeatBoss,
    recordGamePlay,
    setNickname,
    setAvatar,
    setYearLevel,
    toggleMute,
    resetProgress,
  };
}
