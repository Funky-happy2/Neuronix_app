import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  password: text("password").notNull(),
  avatarId: text("avatar_id").notNull().default("astronaut"),
  xp: integer("xp").notNull().default(0),
  coins: integer("coins").notNull().default(0),
  gems: integer("gems").notNull().default(0),
  level: integer("level").notNull().default(1),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastPlayDate: text("last_play_date"),
  badges: text("badges").array().notNull().default(sql`ARRAY[]::text[]`),
  gameScores: jsonb("game_scores").notNull().default(sql`'{}'::jsonb`),
  gamesWon: integer("games_won").notNull().default(0),
  totalGamesPlayed: integer("total_games_played").notNull().default(0),
  inventory: text("inventory").array().notNull().default(sql`ARRAY[]::text[]`),
  equippedTheme: text("equipped_theme").notNull().default("default"),
  isMuted: boolean("is_muted").notNull().default(false),
  dailyChallengesCompleted: integer("daily_challenges_completed").notNull().default(0),
  lastDailyChallengeDate: text("last_daily_challenge_date"),
  bossesDefeated: jsonb("bosses_defeated").notNull().default(sql`'{}'::jsonb`),
  yearLevel: integer("year_level").notNull().default(7),
  isAdmin: boolean("is_admin").notNull().default(false),
  banned: boolean("banned").notNull().default(false),
  strikes: integer("strikes").notNull().default(0),
  isDeleted: boolean("is_deleted").notNull().default(false),
  clanId: integer("clan_id"),
  teamId: integer("team_id"),
  rebirthLevel: integer("rebirth_level").notNull().default(0),
  rebirthMultiplier: integer("rebirth_multiplier").notNull().default(100),
  tournamentWins: integer("tournament_wins").notNull().default(0),
  tournamentXp: integer("tournament_xp").notNull().default(0),
  potions: text("potions").array().notNull().default(sql`ARRAY[]::text[]`),
  activePotions: jsonb("active_potions").notNull().default(sql`'[]'::jsonb`),
  potionsUsed: integer("potions_used").notNull().default(0),
  equippedCosmetics: jsonb("equipped_cosmetics").notNull().default(sql`'{}'::jsonb`),
  lastStreakShieldDate: text("last_streak_shield_date"),
  lastDailyRewardDate: text("last_daily_reward_date"),
  dailyRewardStreak: integer("daily_reward_streak").notNull().default(0),
  mysteryBoxesOpened: integer("mystery_boxes_opened").notNull().default(0),
  battlePowerups: jsonb("battle_powerups").notNull().default(sql`'{}'::jsonb`),
  upgradeExpirations: jsonb("upgrade_expirations").notNull().default(sql`'{}'::jsonb`),
  totalBoostsReceived: integer("total_boosts_received").notNull().default(0),
  isUltraAdmin: boolean("is_ultra_admin").notNull().default(false),
  isTeacher: boolean("is_teacher").notNull().default(false),
  classId: integer("class_id"),
  schoolId: integer("school_id"),
  itemLevels: jsonb("item_levels").notNull().default(sql`'{}'::jsonb`),
  safetySettings: jsonb("safety_settings").notNull().default(sql`'{}'::jsonb`),
  winStreak: integer("win_streak").notNull().default(0),
  winStreakPeak: integer("win_streak_peak").notNull().default(0),
  tournamentWinStreak: integer("tournament_win_streak").notNull().default(0),
  tournamentWinStreakPeak: integer("tournament_win_streak_peak").notNull().default(0),
  isVip: boolean("is_vip").default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const clans = pgTable("clans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  tag: text("tag").notNull().unique(),
  description: text("description").notNull().default(""),
  leaderId: integer("leader_id").notNull(),
  leaderName: text("leader_name").notNull(),
  coLeaders: jsonb("co_leaders").notNull().default([]),
  icon: text("icon").notNull().default("Shield"),
  color: text("color").notNull().default("hsl(270, 85%, 55%)"),
  motto: text("motto").notNull().default(""),
  goals: text("goals").notNull().default(""),
  plans: text("plans").notNull().default(""),
  attributes: text("attributes").notNull().default(""),
  recruiting: boolean("recruiting").notNull().default(true),
  joinTest: jsonb("join_test").notNull().default([]),
  memberCount: integer("member_count").notNull().default(1),
  totalXP: integer("total_xp").notNull().default(0),
  totalCoins: integer("total_coins").notNull().default(0),
  totalGems: integer("total_gems").notNull().default(0),
  totalBadges: integer("total_badges").notNull().default(0),
  createdAt: text("created_at").notNull(),
  election: jsonb("election"),
});

export const insertClanSchema = createInsertSchema(clans).omit({ id: true });
export type InsertClan = z.infer<typeof insertClanSchema>;
export type Clan = typeof clans.$inferSelect;

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  leaderId: integer("leader_id").notNull(),
  leaderName: text("leader_name").notNull(),
  icon: text("icon").notNull().default("⚡"),
  color: text("color").notNull().default("hsl(220, 85%, 55%)"),
  memberCount: integer("member_count").notNull().default(1),
  totalXP: integer("total_xp").notNull().default(0),
  totalCoins: integer("total_coins").notNull().default(0),
  totalBadges: integer("total_badges").notNull().default(0),
  createdAt: text("created_at").notNull(),
  election: jsonb("election"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const shopItems = pgTable("shop_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  icon: text("icon").notNull(),
  rarity: text("rarity").notNull().default("common"),
  requiredLevel: integer("required_level").notNull().default(1),
  requiredRebirth: integer("required_rebirth").notNull().default(0),
  requiredXp: integer("required_xp").notNull().default(0),
  rewardSource: text("reward_source"),
});

export const insertShopItemSchema = createInsertSchema(shopItems);
export type InsertShopItem = z.infer<typeof insertShopItemSchema>;
export type ShopItem = typeof shopItems.$inferSelect;

export const dailyChallenges = pgTable("daily_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull().unique(),
  gameId: text("game_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetScore: integer("target_score").notNull(),
  xpReward: integer("xp_reward").notNull().default(50),
});

export const insertDailyChallengeSchema = createInsertSchema(dailyChallenges).omit({ id: true });
export type InsertDailyChallenge = z.infer<typeof insertDailyChallengeSchema>;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;

export interface GameMode {
  id: string;
  name: string;
  description: string;
  scienceConcept: string;
  category: string;
  icon: string;
  color: string;
  gradient: string;
  howToPlay: string;
  scoring: string;
  levelProgression: string;
  reward: string;
  isSecret: boolean;
  requiredBadges?: number;
  requiredRebirth?: number;
  requiredXp?: number;
  requiredBosses?: number;
  requiredGames?: number;
  gameType: string;
  world?: string;
}

export interface BossMutation {
  name: string;
  title: string;
  description: string;
  icon: string;
  gradient: string;
  phases: number;
  difficulty: string;
  reward: string;
  badgeId: string;
}

export interface BossBattle {
  id: string;
  name: string;
  title: string;
  description: string;
  scienceConcepts: string[];
  requiredSkills: string[];
  phases: number;
  difficulty: string;
  icon: string;
  color: string;
  gradient: string;
  reward: string;
  badgeId: string;
  mutations: BossMutation[];
  isSecret?: boolean;
  requiredRebirth?: number;
  requiredXp?: number;
  requiredBadges?: number;
  requiredGames?: number;
  requiredBosses?: number;
  unlockRequirement?: string;
  unlockCheck?: (ctx: { xp: number; bossesDefeated: Record<string, number>; badges: string[]; totalGamesPlayed: number }) => boolean;
  world?: string;
}

export interface WorldInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  unlockLevel: number;
  unlockXp: number;
  unlockBosses: number;
  gemCost?: number;
  coinCost?: number;
  requiredWorldId?: string;
  gameIds: string[];
  bossId: string;
  shopItemIds: string[];
  badgeIds: string[];
}

export interface LabExperiment {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: { name: string; min: number; max: number; default: number; unit: string }[];
  learningOutcome: string;
  icon: string;
  color: string;
  isSecret?: boolean;
  requiredRebirth?: number;
  requiredXp?: number;
  requiredBadges?: number;
  requiredBosses?: number;
  requiredGames?: number;
  unlockRequirement?: string;
  worldId?: string;
}

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type BadgeTopic = "games" | "bosses" | "progression" | "coins" | "collection" | "competitive" | "special" | "social";

export interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement: string;
  rarity: BadgeRarity;
  topic: BadgeTopic;
}

export interface AvatarInfo {
  id: string;
  name: string;
  icon: string;
  requiredLevel: number;
}

export const communityPacks = pgTable("community_packs", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull(),
  creatorName: text("creator_name").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  gameMode: text("game_mode").notNull().default("speed_quiz"),
  yearLevel: integer("year_level").notNull().default(7),
  likes: integer("likes").notNull().default(0),
  boosts: integer("boosts").notNull().default(0),
  plays: integer("plays").notNull().default(0),
  createdAt: text("created_at").notNull(),
  approved: boolean("approved").notNull().default(false),
});

export const insertCommunityPackSchema = createInsertSchema(communityPacks).omit({ id: true });
export type InsertCommunityPack = z.infer<typeof insertCommunityPackSchema>;
export type CommunityPack = typeof communityPacks.$inferSelect;

export const communityQuestions = pgTable("community_questions", {
  id: serial("id").primaryKey(),
  packId: integer("pack_id").notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation"),
});

export const insertCommunityQuestionSchema = createInsertSchema(communityQuestions).omit({ id: true });
export type InsertCommunityQuestion = z.infer<typeof insertCommunityQuestionSchema>;
export type CommunityQuestion = typeof communityQuestions.$inferSelect;

export const communityReactions = pgTable("community_reactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  packId: integer("pack_id").notNull(),
  type: text("type").notNull(),
});

export type CommunityReaction = typeof communityReactions.$inferSelect;

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
  read: boolean("read").notNull().default(false),
  adminReply: text("admin_reply"),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export const newsPosts = pgTable("news_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("update"),
  authorId: integer("author_id").notNull(),
  authorName: text("author_name").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull().default("approved"),
});

export const insertNewsPostSchema = createInsertSchema(newsPosts).omit({ id: true });
export type InsertNewsPost = z.infer<typeof insertNewsPostSchema>;
export type NewsPost = typeof newsPosts.$inferSelect;

export const newsComments = pgTable("news_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertNewsCommentSchema = createInsertSchema(newsComments).omit({ id: true });
export type InsertNewsComment = z.infer<typeof insertNewsCommentSchema>;
export type NewsComment = typeof newsComments.$inferSelect;

export const newsReactions = pgTable("news_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
  emoji: text("emoji").notNull(),
});

export type NewsReaction = typeof newsReactions.$inferSelect;

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("admin"),
  status: text("status").notNull().default("upcoming"),
  packId: integer("pack_id"),
  questions: jsonb("questions").notNull().default([]),
  maxTeams: integer("max_teams").notNull().default(20),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  xpReward: integer("xp_reward").notNull().default(100),
  coinReward: integer("coin_reward").notNull().default(50),
  gemReward: integer("gem_reward").notNull().default(0),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  gameMode: text("game_mode").notNull().default("quiz"),
  format: text("format").notNull().default("open"),
  scope: text("scope").notNull().default("team"),
  currentRound: integer("current_round").notNull().default(1),
  maxRounds: integer("max_rounds").notNull().default(1),
  bracket: jsonb("bracket").notNull().default([]),
});

export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournaments.$inferSelect;

export const tournamentEntries = pgTable("tournament_entries", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  teamId: integer("team_id"),
  teamName: text("team_name").notNull(),
  userId: integer("user_id"),
  score: integer("score").notNull().default(0),
  timeTaken: integer("time_taken").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  playedBy: jsonb("played_by").notNull().default([]),
  submittedAt: text("submitted_at"),
  round: integer("round").notNull().default(1),
  eliminated: boolean("eliminated").notNull().default(false),
});

export const insertTournamentEntrySchema = createInsertSchema(tournamentEntries).omit({ id: true });
export type InsertTournamentEntry = z.infer<typeof insertTournamentEntrySchema>;
export type TournamentEntry = typeof tournamentEntries.$inferSelect;

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  sellerName: text("seller_name").notNull(),
  offerItems: text("offer_items").array().notNull().default(sql`ARRAY[]::text[]`),
  offerCoins: integer("offer_coins").notNull().default(0),
  offerGems: integer("offer_gems").notNull().default(0),
  offerXp: integer("offer_xp").notNull().default(0),
  offerPotions: text("offer_potions").array().notNull().default(sql`ARRAY[]::text[]`),
  wantItems: text("want_items").array().notNull().default(sql`ARRAY[]::text[]`),
  wantCoins: integer("want_coins").notNull().default(0),
  wantGems: integer("want_gems").notNull().default(0),
  wantXp: integer("want_xp").notNull().default(0),
  wantPotions: text("want_potions").array().notNull().default(sql`ARRAY[]::text[]`),
  recipientName: text("recipient_name"),
  maxUses: integer("max_uses"),
  timesAccepted: integer("times_accepted").notNull().default(0),
  status: text("status").notNull().default("open"),
  buyerId: integer("buyer_id"),
  buyerName: text("buyer_name"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const insertTradeSchema = createInsertSchema(trades).omit({ id: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export const clanBattles = pgTable("clan_battles", {
  id: serial("id").primaryKey(),
  challengerClanId: integer("challenger_clan_id").notNull(),
  challengerClanName: text("challenger_clan_name").notNull(),
  defenderClanId: integer("defender_clan_id").notNull(),
  defenderClanName: text("defender_clan_name").notNull(),
  status: text("status").notNull().default("pending"),
  matchups: jsonb("matchups").notNull().default([]),
  challengerScore: integer("challenger_score").notNull().default(0),
  defenderScore: integer("defender_score").notNull().default(0),
  winnerId: integer("winner_id"),
  winnerName: text("winner_name"),
  gemReward: integer("gem_reward").notNull().default(10),
  xpReward: integer("xp_reward").notNull().default(500),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const insertClanBattleSchema = createInsertSchema(clanBattles).omit({ id: true });
export type InsertClanBattle = z.infer<typeof insertClanBattleSchema>;
export type ClanBattle = typeof clanBattles.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channelType: text("channel_type").notNull(),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const grandTournaments = pgTable("grand_tournaments", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(),
  status: text("status").notNull().default("registration"),
  phase: text("phase").notNull().default("group"),
  district: text("district").notNull(),
  eventType: text("event_type").notNull(),
  scope: text("scope").notNull().default("individual"),
  groups: jsonb("groups").notNull().default([]),
  knockoutBracket: jsonb("knockout_bracket").notNull().default([]),
  standings: jsonb("standings").notNull().default([]),
  currentRound: integer("current_round").notNull().default(0),
  totalGroupRounds: integer("total_group_rounds").notNull().default(5),
  prizes: jsonb("prizes").notNull().default({}),
  createdAt: text("created_at").notNull(),
});

export const insertGrandTournamentSchema = createInsertSchema(grandTournaments).omit({ id: true });
export type InsertGrandTournament = z.infer<typeof insertGrandTournamentSchema>;
export type GrandTournament = typeof grandTournaments.$inferSelect;

export const grandTournamentEntries = pgTable("grand_tournament_entries", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  userId: integer("user_id"),
  username: text("username").notNull(),
  teamId: integer("team_id"),
  teamName: text("team_name"),
  groupIndex: integer("group_index").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  points: integer("points").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  matchesPlayed: integer("matches_played").notNull().default(0),
  eliminated: boolean("eliminated").notNull().default(false),
  knockoutSeed: integer("knockout_seed"),
  finalRank: integer("final_rank"),
  pendingScore: integer("pending_score"),
});

export const insertGrandTournamentEntrySchema = createInsertSchema(grandTournamentEntries).omit({ id: true });
export type InsertGrandTournamentEntry = z.infer<typeof insertGrandTournamentEntrySchema>;
export type GrandTournamentEntry = typeof grandTournamentEntries.$inferSelect;

export const districtBattles = pgTable("district_battles", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(),
  battleType: text("battle_type").notNull(),
  eventId: text("event_id").notNull(),
  status: text("status").notNull().default("registration"),
  district1: text("district_1").notNull(),
  district2: text("district_2"),
  district1Score: integer("district_1_score").notNull().default(0),
  district2Score: integer("district_2_score").notNull().default(0),
  district1Players: integer("district_1_players").notNull().default(0),
  district2Players: integer("district_2_players").notNull().default(0),
  winner: text("winner"),
  participants: jsonb("participants").notNull().default([]),
  topPlayers: jsonb("top_players").notNull().default([]),
  createdAt: text("created_at").notNull(),
});

export const insertDistrictBattleSchema = createInsertSchema(districtBattles).omit({ id: true });
export type InsertDistrictBattle = z.infer<typeof insertDistrictBattleSchema>;
export type DistrictBattle = typeof districtBattles.$inferSelect;

export const grandTournamentQuestions = pgTable("grand_tournament_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  options: jsonb("options").notNull().$type<string[]>(),
  correctIndex: integer("correct_index").notNull(),
  category: text("category").notNull().default("general"),
  yearLevel: integer("year_level").notNull().default(0),
  createdBy: text("created_by").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const insertGrandTournamentQuestionSchema = createInsertSchema(grandTournamentQuestions).omit({ id: true });
export type InsertGrandTournamentQuestion = z.infer<typeof insertGrandTournamentQuestionSchema>;
export type GrandTournamentQuestion = typeof grandTournamentQuestions.$inferSelect;

export const redemptionCodes = pgTable("redemption_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  coinReward: integer("coin_reward").notNull().default(0),
  gemReward: integer("gem_reward").notNull().default(0),
  xpReward: integer("xp_reward").notNull().default(0),
  mysteryBoxReward: integer("mystery_box_reward").notNull().default(0),
  mysteryBoxType: text("mystery_box_type").notNull().default("bronze"),
  itemRewards: text("item_rewards").array().notNull().default(sql`ARRAY[]::text[]`),
  worldRewards: text("world_rewards").array().notNull().default(sql`ARRAY[]::text[]`),
  potionRewards: text("potion_rewards").array().notNull().default(sql`ARRAY[]::text[]`),
  message: text("message"),
  maxUses: integer("max_uses").notNull().default(1),
  currentUses: integer("current_uses").notNull().default(0),
  isFree: boolean("is_free").notNull().default(false),
  freeCodeIndex: integer("free_code_index"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at"),
});

export const insertRedemptionCodeSchema = createInsertSchema(redemptionCodes).omit({ id: true });
export type InsertRedemptionCode = z.infer<typeof insertRedemptionCodeSchema>;
export type RedemptionCode = typeof redemptionCodes.$inferSelect;

export const codeRedemptions = pgTable("code_redemptions", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").notNull(),
  userId: integer("user_id").notNull(),
  redeemedAt: text("redeemed_at").notNull(),
});

export const insertCodeRedemptionSchema = createInsertSchema(codeRedemptions).omit({ id: true });
export type InsertCodeRedemption = z.infer<typeof insertCodeRedemptionSchema>;
export type CodeRedemption = typeof codeRedemptions.$inferSelect;

export const siteMessages = pgTable("site_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertSiteMessageSchema = createInsertSchema(siteMessages).omit({ id: true });
export type InsertSiteMessage = z.infer<typeof insertSiteMessageSchema>;
export type SiteMessage = typeof siteMessages.$inferSelect;

export const adminProposals = pgTable("admin_proposals", {
  id: serial("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  type: text("type").notNull(),
  targetId: integer("target_id"),
  targetName: text("target_name"),
  actionData: jsonb("action_data").notNull().default(sql`'{}'::jsonb`),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  isSmallIssue: boolean("is_small_issue").notNull().default(false),
  votes: jsonb("votes").notNull().default(sql`'{}'::jsonb`),
  resolvedById: integer("resolved_by_id"),
  resolvedByName: text("resolved_by_name"),
  resolvedAt: text("resolved_at"),
});
export const insertAdminProposalSchema = createInsertSchema(adminProposals).omit({ id: true });
export type InsertAdminProposal = z.infer<typeof insertAdminProposalSchema>;
export type AdminProposal = typeof adminProposals.$inferSelect;

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  code: text("code").notNull().unique(),
  usedCount: integer("used_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

export const referralUses = pgTable("referral_uses", {
  id: serial("id").primaryKey(),
  referralCode: text("referral_code").notNull(),
  usedByUserId: integer("used_by_user_id").notNull(),
  usedAt: text("used_at").notNull(),
});

export type ReferralUse = typeof referralUses.$inferSelect;

export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true });
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  schoolId: integer("school_id"),
  teacherId: integer("teacher_id").notNull(),
  teacherName: text("teacher_name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
  safetySettings: jsonb("safety_settings").notNull().default(sql`'{}'::jsonb`),
  bannedMembers: jsonb("banned_members").notNull().default(sql`'[]'::jsonb`),
});
export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  receiverId: integer("receiver_id").notNull(),
  receiverName: text("receiver_name").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});
export const insertFriendshipSchema = createInsertSchema(friendships).omit({ id: true });
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type Friendship = typeof friendships.$inferSelect;

export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  isRead: boolean("is_read").notNull().default(false),
});
export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true });
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

export const suspiciousActivity = pgTable("suspicious_activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  createdAt: text("created_at").notNull(),
  reviewed: boolean("reviewed").notNull().default(false),
});
