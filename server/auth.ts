import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { DIMENSION_GROUPS, hasFullStoneSet } from "@shared/dimensions";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    secret = randomBytes(32).toString("hex");
    console.warn(
      "SESSION_SECRET not set — generated an ephemeral dev secret. Sessions will not survive a restart.",
    );
  }
  const sessionSettings: session.SessionOptions = {
    secret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? false);
    } catch (err) {
      done(err as Error);
    }
  });

  const ULTRA_ADMIN = "Funky_happy2";

  app.post("/api/register", async (req, res, next) => {
    const { username, password, refCode, isTeacher } = req.body;
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      username,
      password: await hashPassword(password),
      isTeacher: isTeacher === true || isTeacher === "true" || false,
    } as any);

    if (user.username === ULTRA_ADMIN && !user.isAdmin) {
      await storage.updateUser(user.id, { isAdmin: true });
      (user as any).isAdmin = true;
    }

    if (refCode && typeof refCode === "string") {
      try {
        const referral = await storage.getReferralByCode(refCode.trim().toUpperCase());
        if (
          referral &&
          referral.user_id !== user.id &&
          Number(referral.used_count) < 4
        ) {
          const alreadyUsed = await storage.getReferralUseByUser(referral.code, user.id);
          if (!alreadyUsed) {
            await storage.createReferralUse(referral.code, user.id);
            await storage.incrementReferralUseCount(referral.code);
            await storage.updateUser(user.id, { coins: user.coins + 100 });
            const referrer = await storage.getUser(referral.user_id);
            if (referrer) {
              await storage.updateUser(referrer.id, { coins: referrer.coins + 100 });
            }
          }
        }
      } catch {}
    }

    req.login(user, (err) => {
      if (err) return next(err);
      const { password: _, ...safeUser } = user as any;
      res.status(201).json(safeUser);
    });
  });

  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    const u = req.user as any;
    if (u.username === ULTRA_ADMIN && !u.isAdmin) {
      await storage.updateUser(u.id, { isAdmin: true });
      u.isAdmin = true;
    }
    const { password: _, ...safeUser } = u;
    res.status(200).json(safeUser);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    let freshUser = await storage.getUser((req.user as any).id);
    if (!freshUser) return res.sendStatus(401);

    if (freshUser.username === ULTRA_ADMIN && !freshUser.isAdmin) {
      await storage.updateUser(freshUser.id, { isAdmin: true });
      freshUser = { ...freshUser, isAdmin: true };
    }

    try {
      const inventory = freshUser.inventory || [];
      const allShopItems = await storage.getShopItems();
      const rewardsBySource = new Map<string, typeof allShopItems>();
      for (const item of allShopItems) {
        if (item.rewardSource) {
          const list = rewardsBySource.get(item.rewardSource) || [];
          list.push(item);
          rewardsBySource.set(item.rewardSource, list);
        }
      }
      const missingItems: string[] = [];
      const addMissing = (source: string) => {
        for (const ri of rewardsBySource.get(source) || []) {
          if (!inventory.includes(ri.id) && !missingItems.includes(ri.id)) missingItems.push(ri.id);
        }
      };

      const bossesDefeated = freshUser.bossesDefeated as Record<string, number> || {};
      const defeatedBossIds = Object.keys(bossesDefeated).filter(b => (bossesDefeated[b] || 0) > 0);
      for (const bossId of defeatedBossIds) {
        addMissing(`boss:${bossId}`);
      }
      const REGULAR_BOSSES = ["chaos-storm", "dr-blackout", "mutation-master", "professor-meltdown", "gravity-king", "plague-lord", "tecton-the-shaker", "nebula-queen"];
      const WORLD_BOSSES = ["the-kraken", "magma-titan", "frost-wyrm", "jungle-hydra", "cosmic-entity", "crystal-golem", "thunder-king", "virus-prime", "rex-overlord", "quantum-phantom"];
      if (REGULAR_BOSSES.every(b => (bossesDefeated[b] || 0) > 0)) addMissing("boss:all-regular");
      if (WORLD_BOSSES.every(b => (bossesDefeated[b] || 0) > 0)) addMissing("boss:all-world");
      if (defeatedBossIds.some(b => (bossesDefeated[b] || 0) >= 3)) addMissing("boss:any-omega");

      const userXp = freshUser.xp || 0;
      const XP_THRESHOLDS = [5000, 25000, 50000, 100000];
      for (const threshold of XP_THRESHOLDS) {
        if (userXp >= threshold) addMissing(`xp:${threshold}`);
      }

      const rebirthLevel = (freshUser as any).rebirthLevel || 0;
      const REBIRTH_THRESHOLDS = [1, 5];
      for (const threshold of REBIRTH_THRESHOLDS) {
        if (rebirthLevel >= threshold) addMissing(`rebirth:${threshold}`);
      }

      const longestStreak = freshUser.longestStreak || 0;
      if (longestStreak >= 30) addMissing("streak:30");

      const totalGamesPlayed = freshUser.totalGamesPlayed || 0;
      if (totalGamesPlayed >= 100) addMissing("games:100");

      if (missingItems.length > 0) {
        await storage.updateUser(freshUser.id, { inventory: [...inventory, ...missingItems] });
        freshUser = await storage.getUser(freshUser.id) as typeof freshUser;
      }

      // Retroactively award streak badges missed due to timing or deployments
      // Checks both the play streak (longestStreak) and the daily-reward streak
      const currentBadges = [...((freshUser.badges as string[]) || [])];
      const streakBadgeMilestones: [number, string][] = [[7, "streak-master"], [14, "streak-legend"], [30, "streak-titan"]];
      const dailyRewardStreak = (freshUser as any).dailyRewardStreak || 0;
      const highestStreak = Math.max(longestStreak, dailyRewardStreak);
      let badgesChanged = false;
      for (const [threshold, badge] of streakBadgeMilestones) {
        if (highestStreak >= threshold && !currentBadges.includes(badge)) {
          currentBadges.push(badge);
          badgesChanged = true;
        }
      }
      if (badgesChanged) {
        await storage.updateUser(freshUser.id, { badges: currentBadges } as any);
        freshUser = await storage.getUser(freshUser.id) as typeof freshUser;
      }
    } catch (err) {
      console.error("Retroactive reward check failed:", err);
    }

    // Catch-up: if a dimension stone-set is complete, make sure its cosmetics
    // (avatar, border, badge) were actually granted — not just the live buff.
    try {
      const inv = [...(freshUser.inventory || [])];
      const bdg = [...((freshUser.badges as string[]) || [])];
      let changed = false;
      for (const g of DIMENSION_GROUPS) {
        if (g.grandReward && hasFullStoneSet(g, inv)) {
          const gr = g.grandReward;
          for (const it of [gr.completeFlag, gr.avatarId, gr.borderId]) {
            if (!inv.includes(it)) { inv.push(it); changed = true; }
          }
          if (!bdg.includes(gr.badgeId)) { bdg.push(gr.badgeId); changed = true; }
        }
      }
      if (changed) {
        await storage.updateUser(freshUser.id, { inventory: inv, badges: bdg } as any);
        freshUser = await storage.getUser(freshUser.id) as typeof freshUser;
      }
    } catch (err) {
      console.error("Dimension cosmetic catch-up failed:", err);
    }

    const { password, ...safeUser } = freshUser as any;
    let classSafetySettings = {};
    if (freshUser.classId) {
      try {
        const cls = await storage.getClass(freshUser.classId);
        if (cls) classSafetySettings = (cls as any).safetySettings || {};
      } catch {}
    }
    let clanName: string | null = null;
    let teamName: string | null = null;
    if (freshUser.clanId) {
      try {
        const clan = await storage.getClan(freshUser.clanId);
        if (clan) clanName = clan.name;
      } catch {}
    }
    if (freshUser.teamId) {
      try {
        const team = await storage.getTeam(freshUser.teamId);
        if (team) teamName = team.name;
      } catch {}
    }
    const restricted = (req.session as any)?.restricted === true;
    const tempExpiresAt = (req.session as any)?.tempExpiresAt ?? null;
    res.json({ ...safeUser, classSafetySettings, clanName, teamName, restricted, tempExpiresAt });
  });
}
