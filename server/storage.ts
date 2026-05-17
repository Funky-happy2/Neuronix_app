import { type User, type InsertUser, type DailyChallenge, type InsertDailyChallenge, type ShopItem, type InsertShopItem, type CommunityPack, type InsertCommunityPack, type CommunityQuestion, type InsertCommunityQuestion, type CommunityReaction, type Feedback, type InsertFeedback, type Clan, type InsertClan, type Team, type InsertTeam, type NewsPost, type InsertNewsPost, type NewsComment, type InsertNewsComment, type NewsReaction, type ChatMessage, type InsertChatMessage, type Tournament, type InsertTournament, type TournamentEntry, type InsertTournamentEntry, type Trade, type InsertTrade, type ClanBattle, type InsertClanBattle, type GrandTournament, type InsertGrandTournament, type GrandTournamentEntry, type InsertGrandTournamentEntry, type DistrictBattle, type InsertDistrictBattle, type GrandTournamentQuestion, type InsertGrandTournamentQuestion, type RedemptionCode, type InsertRedemptionCode, type CodeRedemption, type SiteMessage, type AdminProposal, type InsertAdminProposal, type School, type InsertSchool, type Class, type InsertClass, type Friendship, type InsertFriendship, type DirectMessage, type InsertDirectMessage, users, dailyChallenges, shopItems, communityPacks, communityQuestions, communityReactions, feedback, clans, teams, newsPosts, newsComments, newsReactions, chatMessages, tournaments, tournamentEntries, trades, clanBattles, grandTournaments, grandTournamentEntries, districtBattles, grandTournamentQuestions, redemptionCodes, codeRedemptions, siteMessages, adminProposals, schools, classes } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, sql } from "drizzle-orm";
import pg from "pg";
import session from "express-session";
import connectPg from "connect-pg-simple";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

const PostgresSessionStore = connectPg(session);

function mapProposalRow(row: any) {
  return {
    id: row.id,
    createdAt: row.created_at,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    type: row.type,
    targetId: row.target_id,
    targetName: row.target_name,
    actionData: row.action_data,
    description: row.description,
    status: row.status,
    isSmallIssue: row.is_small_issue,
    votes: row.votes,
    resolvedById: row.resolved_by_id,
    resolvedByName: row.resolved_by_name,
    resolvedAt: row.resolved_at,
  };
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  getDailyChallenge(date: string): Promise<DailyChallenge | undefined>;
  createDailyChallenge(challenge: InsertDailyChallenge): Promise<DailyChallenge>;
  getShopItems(): Promise<ShopItem[]>;
  getLeaderboard(limit?: number): Promise<User[]>;
  getTournamentLeaderboard(limit?: number): Promise<User[]>;
  getCommunityPacks(): Promise<CommunityPack[]>;
  getCommunityPack(id: number): Promise<CommunityPack | undefined>;
  getPacksByCreator(creatorId: number): Promise<CommunityPack[]>;
  createCommunityPack(pack: InsertCommunityPack): Promise<CommunityPack>;
  deleteCommunityPack(id: number, creatorId: number): Promise<boolean>;
  getPackQuestions(packId: number): Promise<CommunityQuestion[]>;
  createPackQuestion(question: InsertCommunityQuestion): Promise<CommunityQuestion>;
  getReaction(userId: number, packId: number, type: string): Promise<CommunityReaction | undefined>;
  addReaction(userId: number, packId: number, type: string): Promise<void>;
  removeReaction(userId: number, packId: number, type: string): Promise<void>;
  incrementPackPlays(packId: number): Promise<void>;
  approvePack(packId: number): Promise<CommunityPack | undefined>;
  getApprovedPacks(): Promise<CommunityPack[]>;
  getAllPacks(): Promise<CommunityPack[]>;
  updatePackQuestions(packId: number, questions: InsertCommunityQuestion[]): Promise<void>;
  deleteCommunityPackAdmin(id: number): Promise<boolean>;
  createFeedback(fb: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  markFeedbackRead(id: number): Promise<void>;
  deleteFeedback(id: number): Promise<void>;
  approveFeedback(id: number, xpReward: number, coinReward: number): Promise<Feedback | undefined>;
  deleteDailyChallenge(date: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  permanentDeleteUser(id: number): Promise<boolean>;
  reviveUser(id: number): Promise<boolean>;
  getClan(id: number): Promise<Clan | undefined>;
  getClanByName(name: string): Promise<Clan | undefined>;
  getAllClans(): Promise<Clan[]>;
  createClan(clan: InsertClan): Promise<Clan>;
  updateClan(id: number, updates: Partial<InsertClan>): Promise<Clan | undefined>;
  deleteClan(id: number): Promise<boolean>;
  getClanMembers(clanId: number): Promise<User[]>;
  getNewsPosts(): Promise<NewsPost[]>;
  getNewsPost(id: number): Promise<NewsPost | undefined>;
  createNewsPost(post: InsertNewsPost): Promise<NewsPost>;
  updateNewsPost(id: number, updates: Partial<InsertNewsPost>): Promise<NewsPost | undefined>;
  deleteNewsPost(id: number): Promise<boolean>;
  getNewsComments(postId: number): Promise<NewsComment[]>;
  getNewsComment(id: number): Promise<NewsComment | undefined>;
  createNewsComment(comment: InsertNewsComment): Promise<NewsComment>;
  deleteNewsComment(id: number): Promise<boolean>;
  getNewsReactions(postId: number): Promise<NewsReaction[]>;
  toggleNewsReaction(postId: number, userId: number, emoji: string): Promise<boolean>;
  getRecentCommentCount(userId: number, sinceMs: number): Promise<number>;
  getUserCosmetics(ids: number[]): Promise<Map<number, { titleId: string | null; isVip: boolean }>>;
  getTeam(id: number): Promise<Team | undefined>;
  getTeamByInviteCode(code: string): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;
  getTeamMembers(teamId: number): Promise<User[]>;
  getChatMessages(channelType: string, channelId: number, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  getTournaments(): Promise<Tournament[]>;
  getTournament(id: number): Promise<Tournament | undefined>;
  createTournament(t: InsertTournament): Promise<Tournament>;
  updateTournament(id: number, updates: Partial<InsertTournament>): Promise<Tournament | undefined>;
  deleteTournament(id: number): Promise<boolean>;
  getTournamentEntries(tournamentId: number): Promise<TournamentEntry[]>;
  getTournamentEntry(tournamentId: number, teamId: number): Promise<TournamentEntry | undefined>;
  createTournamentEntry(entry: InsertTournamentEntry): Promise<TournamentEntry>;
  updateTournamentEntry(id: number, updates: Partial<InsertTournamentEntry>): Promise<TournamentEntry | undefined>;
  getTrades(): Promise<Trade[]>;
  getTrade(id: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade | undefined>;
  claimTrade(id: number, buyerId: number, buyerName: string): Promise<Trade | undefined>;
  deleteTrade(id: number): Promise<boolean>;
  getTournamentEntryByUser(tournamentId: number, userId: number): Promise<TournamentEntry | undefined>;
  deleteTournamentEntriesByUser(userId: number): Promise<void>;
  getClanBattles(): Promise<ClanBattle[]>;
  getClanBattle(id: number): Promise<ClanBattle | undefined>;
  createClanBattle(battle: InsertClanBattle): Promise<ClanBattle>;
  updateClanBattle(id: number, updates: Partial<InsertClanBattle>): Promise<ClanBattle | undefined>;
  getClanBattlesByClan(clanId: number): Promise<ClanBattle[]>;
  getGrandTournaments(month: string): Promise<GrandTournament[]>;
  getGrandTournament(id: number): Promise<GrandTournament | undefined>;
  getGrandTournamentByKey(month: string, district: string, eventType: string): Promise<GrandTournament | undefined>;
  createGrandTournament(t: InsertGrandTournament): Promise<GrandTournament>;
  updateGrandTournament(id: number, updates: Partial<InsertGrandTournament>): Promise<GrandTournament | undefined>;
  getGrandTournamentEntries(tournamentId: number): Promise<GrandTournamentEntry[]>;
  getGrandTournamentEntry(id: number): Promise<GrandTournamentEntry | undefined>;
  getGrandTournamentEntryByUser(tournamentId: number, userId: number): Promise<GrandTournamentEntry | undefined>;
  createGrandTournamentEntry(entry: InsertGrandTournamentEntry): Promise<GrandTournamentEntry>;
  updateGrandTournamentEntry(id: number, updates: Partial<InsertGrandTournamentEntry>): Promise<GrandTournamentEntry | undefined>;
  getDistrictBattles(month: string): Promise<DistrictBattle[]>;
  getDistrictBattle(id: number): Promise<DistrictBattle | undefined>;
  getDistrictBattleByKey(month: string, eventId: string, district1: string, district2?: string): Promise<DistrictBattle | undefined>;
  createDistrictBattle(battle: InsertDistrictBattle): Promise<DistrictBattle>;
  updateDistrictBattle(id: number, updates: Partial<InsertDistrictBattle>): Promise<DistrictBattle | undefined>;
  getGrandTournamentQuestions(activeOnly?: boolean): Promise<GrandTournamentQuestion[]>;
  createGrandTournamentQuestion(q: InsertGrandTournamentQuestion): Promise<GrandTournamentQuestion>;
  updateGrandTournamentQuestion(id: number, updates: Partial<InsertGrandTournamentQuestion>): Promise<GrandTournamentQuestion | undefined>;
  deleteGrandTournamentQuestion(id: number): Promise<boolean>;
  getAllCodes(): Promise<RedemptionCode[]>;
  getCode(id: number): Promise<RedemptionCode | undefined>;
  getCodeByCode(code: string): Promise<RedemptionCode | undefined>;
  createCode(code: InsertRedemptionCode): Promise<RedemptionCode>;
  updateCode(id: number, updates: Partial<InsertRedemptionCode>): Promise<RedemptionCode | undefined>;
  deleteCode(id: number): Promise<boolean>;
  getCodeRedemption(codeId: number, userId: number): Promise<CodeRedemption | undefined>;
  createCodeRedemption(codeId: number, userId: number): Promise<CodeRedemption>;
  getCurrentFreeCode(): Promise<RedemptionCode | undefined>;
  getFreeCodesTotalCount(): Promise<number>;
  getSiteMessages(): Promise<SiteMessage[]>;
  createSiteMessage(content: string, createdBy: string): Promise<SiteMessage>;
  deleteSiteMessage(id: number): Promise<boolean>;
  toggleSiteMessage(id: number, isActive: boolean): Promise<SiteMessage | undefined>;
  getOrCreateReferral(userId: number): Promise<{ id: number; userId: number; code: string; usedCount: number; createdAt: string }>;
  getReferralByCode(code: string): Promise<{ id: number; userId: number; code: string; usedCount: number; createdAt: string } | undefined>;
  getReferralUseByUser(referralCode: string, usedByUserId: number): Promise<{ id: number } | undefined>;
  createReferralUse(referralCode: string, usedByUserId: number): Promise<void>;
  incrementReferralUseCount(code: string): Promise<void>;
  getAdminProposals(): Promise<AdminProposal[]>;
  getAdminProposal(id: number): Promise<AdminProposal | undefined>;
  createAdminProposal(data: InsertAdminProposal): Promise<AdminProposal>;
  updateAdminProposal(id: number, updates: Partial<AdminProposal>): Promise<AdminProposal | undefined>;
  getUltraAdminUser(): Promise<User | undefined>;
  setUltraAdmin(newUserId: number, oldUserId?: number): Promise<void>;
  getSchools(): Promise<School[]>;
  getSchool(id: number): Promise<School | undefined>;
  createSchool(data: InsertSchool): Promise<School>;
  deleteSchool(id: number): Promise<void>;
  getClasses(schoolId?: number): Promise<Class[]>;
  getClass(id: number): Promise<Class | undefined>;
  createClass(data: InsertClass): Promise<Class>;
  updateClass(id: number, updates: Partial<Record<string, unknown>>): Promise<Class | undefined>;
  deleteClass(id: number): Promise<boolean>;
  getClassMembers(classId: number): Promise<User[]>;
  getFriendships(userId: number): Promise<Friendship[]>;
  getFriendship(id: number): Promise<Friendship | undefined>;
  createFriendship(data: InsertFriendship): Promise<Friendship>;
  updateFriendship(id: number, status: string): Promise<Friendship | undefined>;
  deleteFriendship(id: number): Promise<boolean>;
  getDirectMessages(userId: number, friendId: number, limit?: number): Promise<DirectMessage[]>;
  sendDirectMessage(data: InsertDirectMessage): Promise<DirectMessage>;
  markMessagesRead(senderId: number, receiverId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  createSuspiciousReport(userId: number, username: string, reason: string, details: string): Promise<void>;
  getSuspiciousReports(): Promise<{ id: number; userId: number; username: string; reason: string; details: string; createdAt: string; reviewed: boolean }[]>;
  markReportReviewed(id: number): Promise<void>;
  deleteSuspiciousReport(id: number): Promise<void>;
  getWinStreakLeaderboard(limit?: number): Promise<{ id: number; username: string; winStreak: number }[]>;
  replyToFeedback(id: number, reply: string): Promise<void>;
  getUserFeedback(userId: number): Promise<Feedback[]>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.username, username), eq(users.isDeleted as any, false)));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async getDailyChallenge(date: string): Promise<DailyChallenge | undefined> {
    const [challenge] = await db.select().from(dailyChallenges).where(eq(dailyChallenges.date, date));
    return challenge;
  }

  async createDailyChallenge(challenge: InsertDailyChallenge): Promise<DailyChallenge> {
    const [created] = await db.insert(dailyChallenges).values(challenge).returning();
    return created;
  }

  async getShopItems(): Promise<ShopItem[]> {
    return db.select().from(shopItems);
  }

  async getLeaderboard(limit = 50): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.isAdmin, false), eq(users.isDeleted as any, false))).orderBy(desc(users.xp)).limit(limit);
  }

  async getTournamentLeaderboard(limit = 100): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.isAdmin, false), eq(users.isDeleted as any, false))).orderBy(desc(users.tournamentXp)).limit(limit);
  }

  async getCommunityPacks(): Promise<CommunityPack[]> {
    return db.select().from(communityPacks).where(eq(communityPacks.approved, true)).orderBy(desc(communityPacks.plays));
  }

  async getCommunityPack(id: number): Promise<CommunityPack | undefined> {
    const [pack] = await db.select().from(communityPacks).where(eq(communityPacks.id, id));
    return pack;
  }

  async getPacksByCreator(creatorId: number): Promise<CommunityPack[]> {
    return db.select().from(communityPacks).where(eq(communityPacks.creatorId, creatorId)).orderBy(desc(communityPacks.createdAt));
  }

  async createCommunityPack(pack: InsertCommunityPack): Promise<CommunityPack> {
    const [created] = await db.insert(communityPacks).values(pack).returning();
    return created;
  }

  async deleteCommunityPack(id: number, creatorId: number): Promise<boolean> {
    const [pack] = await db.select().from(communityPacks).where(and(eq(communityPacks.id, id), eq(communityPacks.creatorId, creatorId)));
    if (!pack) return false;
    await db.delete(communityQuestions).where(eq(communityQuestions.packId, id));
    await db.delete(communityReactions).where(eq(communityReactions.packId, id));
    await db.delete(communityPacks).where(eq(communityPacks.id, id));
    return true;
  }

  async getPackQuestions(packId: number): Promise<CommunityQuestion[]> {
    return db.select().from(communityQuestions).where(eq(communityQuestions.packId, packId));
  }

  async createPackQuestion(question: InsertCommunityQuestion): Promise<CommunityQuestion> {
    const [created] = await db.insert(communityQuestions).values(question).returning();
    return created;
  }

  async getReaction(userId: number, packId: number, type: string): Promise<CommunityReaction | undefined> {
    const [reaction] = await db.select().from(communityReactions).where(
      and(eq(communityReactions.userId, userId), eq(communityReactions.packId, packId), eq(communityReactions.type, type))
    );
    return reaction;
  }

  async addReaction(userId: number, packId: number, type: string): Promise<void> {
    await db.insert(communityReactions).values({ userId, packId, type });
    if (type === "like") {
      await db.update(communityPacks).set({ likes: sql`${communityPacks.likes} + 1` }).where(eq(communityPacks.id, packId));
    } else if (type === "boost") {
      await db.update(communityPacks).set({ boosts: sql`${communityPacks.boosts} + 1` }).where(eq(communityPacks.id, packId));
    }
  }

  async removeReaction(userId: number, packId: number, type: string): Promise<void> {
    await db.delete(communityReactions).where(
      and(eq(communityReactions.userId, userId), eq(communityReactions.packId, packId), eq(communityReactions.type, type))
    );
    if (type === "like") {
      await db.update(communityPacks).set({ likes: sql`GREATEST(${communityPacks.likes} - 1, 0)` }).where(eq(communityPacks.id, packId));
    } else if (type === "boost") {
      await db.update(communityPacks).set({ boosts: sql`GREATEST(${communityPacks.boosts} - 1, 0)` }).where(eq(communityPacks.id, packId));
    }
  }

  async incrementPackPlays(packId: number): Promise<void> {
    await db.update(communityPacks).set({ plays: sql`${communityPacks.plays} + 1` }).where(eq(communityPacks.id, packId));
  }

  async approvePack(packId: number): Promise<CommunityPack | undefined> {
    const [updated] = await db.update(communityPacks).set({ approved: true }).where(eq(communityPacks.id, packId)).returning();
    return updated;
  }

  async getApprovedPacks(): Promise<CommunityPack[]> {
    return db.select().from(communityPacks).where(eq(communityPacks.approved, true)).orderBy(desc(communityPacks.plays));
  }

  async getAllPacks(): Promise<CommunityPack[]> {
    return db.select().from(communityPacks).orderBy(desc(communityPacks.createdAt));
  }

  async updatePackQuestions(packId: number, questions: { packId: number; question: string; options: string[]; correctIndex: number; explanation: string | null }[]): Promise<void> {
    await db.delete(communityQuestions).where(eq(communityQuestions.packId, packId));
    for (const q of questions) {
      await db.insert(communityQuestions).values(q);
    }
  }

  async deleteCommunityPackAdmin(id: number): Promise<boolean> {
    const [pack] = await db.select().from(communityPacks).where(eq(communityPacks.id, id));
    if (!pack) return false;
    await db.delete(communityQuestions).where(eq(communityQuestions.packId, id));
    await db.delete(communityReactions).where(eq(communityReactions.packId, id));
    await db.delete(communityPacks).where(eq(communityPacks.id, id));
    return true;
  }

  async createFeedback(fb: InsertFeedback): Promise<Feedback> {
    const [created] = await db.insert(feedback).values(fb).returning();
    return created;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return db.select().from(feedback).orderBy(desc(feedback.createdAt));
  }

  async markFeedbackRead(id: number): Promise<void> {
    await db.update(feedback).set({ read: true }).where(eq(feedback.id, id));
  }

  async deleteFeedback(id: number): Promise<void> {
    await db.delete(feedback).where(eq(feedback.id, id));
  }

  async approveFeedback(id: number, xpReward: number, coinReward: number): Promise<Feedback | undefined> {
    const [fb] = await db.select().from(feedback).where(eq(feedback.id, id));
    if (!fb) return undefined;
    await db.update(feedback).set({ read: true }).where(eq(feedback.id, id));
    const userRow = await db.select().from(users).where(eq(users.id, fb.userId)).then(r => r[0]);
    if (userRow) {
      const newXp = userRow.xp + xpReward;
      const newCoins = userRow.coins + coinReward;
      await db.update(users).set({ xp: newXp, coins: newCoins }).where(eq(users.id, fb.userId));
    }
    return { ...fb, read: true };
  }

  async replyToFeedback(id: number, reply: string): Promise<void> {
    await db.update(feedback).set({ adminReply: reply, read: true }).where(eq(feedback.id, id));
  }

  async getUserFeedback(userId: number): Promise<Feedback[]> {
    return db.select().from(feedback).where(eq(feedback.userId, userId)).orderBy(desc(feedback.createdAt));
  }

  async deleteDailyChallenge(date: string): Promise<void> {
    await db.delete(dailyChallenges).where(eq(dailyChallenges.date, date));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.xp));
  }

  async deleteUser(id: number): Promise<boolean> {
    const [updated] = await db.update(users).set({ isDeleted: true } as any).where(eq(users.id, id)).returning();
    return !!updated;
  }

  async permanentDeleteUser(id: number): Promise<boolean> {
    const userPacks = await db.select({ id: communityPacks.id }).from(communityPacks).where(eq(communityPacks.creatorId, id));
    for (const pack of userPacks) {
      await db.delete(communityQuestions).where(eq(communityQuestions.packId, pack.id));
      await db.delete(communityReactions).where(eq(communityReactions.packId, pack.id));
    }
    await db.delete(communityPacks).where(eq(communityPacks.creatorId, id));
    await db.delete(communityReactions).where(eq(communityReactions.userId, id));
    await db.delete(feedback).where(eq(feedback.userId, id));
    const result = await db.delete(users).where(eq(users.id, id));
    return (result as any).rowCount > 0;
  }

  async reviveUser(id: number): Promise<boolean> {
    const [updated] = await db.update(users).set({ isDeleted: false, banned: false } as any).where(eq(users.id, id)).returning();
    return !!updated;
  }

  async getClan(id: number): Promise<Clan | undefined> {
    const [clan] = await db.select().from(clans).where(eq(clans.id, id));
    return clan;
  }

  async getClanByName(name: string): Promise<Clan | undefined> {
    const [clan] = await db.select().from(clans).where(eq(clans.name, name));
    return clan;
  }

  async getAllClans(): Promise<Clan[]> {
    return db.select().from(clans).orderBy(desc(clans.totalXP));
  }

  async createClan(clan: InsertClan): Promise<Clan> {
    const [created] = await db.insert(clans).values(clan).returning();
    return created;
  }

  async updateClan(id: number, updates: Partial<InsertClan>): Promise<Clan | undefined> {
    const [updated] = await db.update(clans).set(updates).where(eq(clans.id, id)).returning();
    return updated;
  }

  async deleteClan(id: number): Promise<boolean> {
    await db.update(users).set({ clanId: null } as any).where(eq(users.clanId, id));
    const result = await db.delete(clans).where(eq(clans.id, id));
    return (result as any).rowCount > 0;
  }

  async getClanMembers(clanId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.clanId, clanId)).orderBy(desc(users.xp));
  }

  async getNewsPosts(): Promise<NewsPost[]> {
    return db.select().from(newsPosts).orderBy(desc(newsPosts.pinned), desc(newsPosts.createdAt));
  }

  async getNewsPost(id: number): Promise<NewsPost | undefined> {
    const [post] = await db.select().from(newsPosts).where(eq(newsPosts.id, id));
    return post;
  }

  async createNewsPost(post: InsertNewsPost): Promise<NewsPost> {
    const [created] = await db.insert(newsPosts).values(post).returning();
    return created;
  }

  async updateNewsPost(id: number, updates: Partial<InsertNewsPost>): Promise<NewsPost | undefined> {
    const [updated] = await db.update(newsPosts).set(updates).where(eq(newsPosts.id, id)).returning();
    return updated;
  }

  async deleteNewsPost(id: number): Promise<boolean> {
    await db.delete(newsComments).where(eq(newsComments.postId, id));
    await db.delete(newsReactions).where(eq(newsReactions.postId, id));
    const result = await db.delete(newsPosts).where(eq(newsPosts.id, id));
    return (result as any).rowCount > 0;
  }

  async getNewsComment(id: number): Promise<NewsComment | undefined> {
    const [comment] = await db.select().from(newsComments).where(eq(newsComments.id, id));
    return comment;
  }

  async getNewsComments(postId: number): Promise<NewsComment[]> {
    return db.select().from(newsComments).where(eq(newsComments.postId, postId)).orderBy(desc(newsComments.createdAt));
  }

  async createNewsComment(comment: InsertNewsComment): Promise<NewsComment> {
    const [created] = await db.insert(newsComments).values(comment).returning();
    return created;
  }

  async deleteNewsComment(id: number): Promise<boolean> {
    const result = await db.delete(newsComments).where(eq(newsComments.id, id));
    return (result as any).rowCount > 0;
  }

  async getNewsReactions(postId: number): Promise<NewsReaction[]> {
    return db.select().from(newsReactions).where(eq(newsReactions.postId, postId));
  }

  async toggleNewsReaction(postId: number, userId: number, emoji: string): Promise<boolean> {
    const [existing] = await db.select().from(newsReactions)
      .where(and(eq(newsReactions.postId, postId), eq(newsReactions.userId, userId), eq(newsReactions.emoji, emoji)));
    if (existing) {
      await db.delete(newsReactions).where(eq(newsReactions.id, existing.id));
      return false;
    } else {
      await db.insert(newsReactions).values({ postId, userId, emoji });
      return true;
    }
  }

  async getRecentCommentCount(userId: number, sinceMs: number): Promise<number> {
    const sinceDate = new Date(Date.now() - sinceMs).toISOString();
    const result = await db.select({ count: sql<number>`count(*)` }).from(newsComments)
      .where(and(eq(newsComments.userId, userId), sql`${newsComments.createdAt} > ${sinceDate}`));
    return Number(result[0]?.count || 0);
  }

  async getUserCosmetics(ids: number[]): Promise<Map<number, { titleId: string | null; isVip: boolean }>> {
    if (ids.length === 0) return new Map();
    const result = await pool.query(
      `SELECT id, (equipped_cosmetics->>'title') as title_id, is_vip FROM users WHERE id = ANY($1)`,
      [ids]
    );
    const map = new Map<number, { titleId: string | null; isVip: boolean }>();
    for (const row of result.rows) {
      map.set(Number(row.id), { titleId: row.title_id || null, isVip: Boolean(row.is_vip) });
    }
    return map;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getTeamByInviteCode(code: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.inviteCode, code));
    return team;
  }

  async getAllTeams(): Promise<Team[]> {
    return db.select().from(teams).orderBy(desc(teams.totalXP));
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  async updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updated] = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return updated;
  }

  async deleteTeam(id: number): Promise<boolean> {
    await db.update(users).set({ teamId: null } as any).where(eq(users.teamId, id));
    const result = await db.delete(teams).where(eq(teams.id, id));
    return (result as any).rowCount > 0;
  }

  async getTeamMembers(teamId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.teamId, teamId)).orderBy(desc(users.xp));
  }

  async getChatMessages(channelType: string, channelId: number, limit: number = 50): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .where(and(eq(chatMessages.channelType, channelType), eq(chatMessages.channelId, channelId)))
      .orderBy(desc(chatMessages.id))
      .limit(limit);
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(msg).returning();
    return created;
  }

  async getTournaments(): Promise<Tournament[]> {
    return db.select().from(tournaments).orderBy(desc(tournaments.id));
  }

  async getTournament(id: number): Promise<Tournament | undefined> {
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return t;
  }

  async createTournament(t: InsertTournament): Promise<Tournament> {
    const [created] = await db.insert(tournaments).values(t).returning();
    return created;
  }

  async updateTournament(id: number, updates: Partial<InsertTournament>): Promise<Tournament | undefined> {
    const [updated] = await db.update(tournaments).set(updates).where(eq(tournaments.id, id)).returning();
    return updated;
  }

  async deleteTournament(id: number): Promise<boolean> {
    await db.delete(tournamentEntries).where(eq(tournamentEntries.tournamentId, id));
    const result = await db.delete(tournaments).where(eq(tournaments.id, id));
    return (result as any).rowCount > 0;
  }

  async getTournamentEntries(tournamentId: number): Promise<TournamentEntry[]> {
    return db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, tournamentId)).orderBy(desc(tournamentEntries.score));
  }

  async getTournamentEntry(tournamentId: number, teamId: number): Promise<TournamentEntry | undefined> {
    const [entry] = await db.select().from(tournamentEntries).where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.teamId, teamId)));
    return entry;
  }

  async createTournamentEntry(entry: InsertTournamentEntry): Promise<TournamentEntry> {
    const [created] = await db.insert(tournamentEntries).values(entry).returning();
    return created;
  }

  async updateTournamentEntry(id: number, updates: Partial<InsertTournamentEntry>): Promise<TournamentEntry | undefined> {
    const [updated] = await db.update(tournamentEntries).set(updates).where(eq(tournamentEntries.id, id)).returning();
    return updated;
  }

  async getTrades(): Promise<Trade[]> {
    return db.select().from(trades).orderBy(desc(trades.id));
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [created] = await db.insert(trades).values(trade).returning();
    return created;
  }

  async updateTrade(id: number, updates: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [updated] = await db.update(trades).set(updates).where(eq(trades.id, id)).returning();
    return updated;
  }

  async claimTrade(id: number, buyerId: number, buyerName: string): Promise<Trade | undefined> {
    const [claimed] = await db.update(trades)
      .set({ status: "completed", buyerId, buyerName, completedAt: new Date().toISOString() })
      .where(and(eq(trades.id, id), eq(trades.status, "open")))
      .returning();
    return claimed;
  }

  async deleteTrade(id: number): Promise<boolean> {
    const result = await db.delete(trades).where(eq(trades.id, id));
    return true;
  }

  async getTournamentEntryByUser(tournamentId: number, userId: number): Promise<TournamentEntry | undefined> {
    const [entry] = await db.select().from(tournamentEntries).where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.userId, userId)));
    return entry;
  }

  async deleteTournamentEntriesByUser(userId: number): Promise<void> {
    await db.delete(tournamentEntries).where(eq(tournamentEntries.userId, userId));
  }

  async getClanBattles(): Promise<ClanBattle[]> {
    return db.select().from(clanBattles).orderBy(desc(clanBattles.id));
  }

  async getClanBattle(id: number): Promise<ClanBattle | undefined> {
    const [battle] = await db.select().from(clanBattles).where(eq(clanBattles.id, id));
    return battle;
  }

  async createClanBattle(battle: InsertClanBattle): Promise<ClanBattle> {
    const [created] = await db.insert(clanBattles).values(battle).returning();
    return created;
  }

  async updateClanBattle(id: number, updates: Partial<InsertClanBattle>): Promise<ClanBattle | undefined> {
    const [updated] = await db.update(clanBattles).set(updates).where(eq(clanBattles.id, id)).returning();
    return updated;
  }

  async getClanBattlesByClan(clanId: number): Promise<ClanBattle[]> {
    const all = await db.select().from(clanBattles).orderBy(desc(clanBattles.id));
    return all.filter(b => b.challengerClanId === clanId || b.defenderClanId === clanId);
  }

  async getGrandTournaments(month: string): Promise<GrandTournament[]> {
    return db.select().from(grandTournaments).where(eq(grandTournaments.month, month)).orderBy(desc(grandTournaments.id));
  }

  async getGrandTournament(id: number): Promise<GrandTournament | undefined> {
    const [t] = await db.select().from(grandTournaments).where(eq(grandTournaments.id, id));
    return t;
  }

  async getGrandTournamentByKey(month: string, district: string, eventType: string): Promise<GrandTournament | undefined> {
    const [t] = await db.select().from(grandTournaments).where(
      and(eq(grandTournaments.month, month), eq(grandTournaments.district, district), eq(grandTournaments.eventType, eventType))
    );
    return t;
  }

  async createGrandTournament(t: InsertGrandTournament): Promise<GrandTournament> {
    const [created] = await db.insert(grandTournaments).values(t).returning();
    return created;
  }

  async updateGrandTournament(id: number, updates: Partial<InsertGrandTournament>): Promise<GrandTournament | undefined> {
    const [updated] = await db.update(grandTournaments).set(updates).where(eq(grandTournaments.id, id)).returning();
    return updated;
  }

  async getGrandTournamentEntries(tournamentId: number): Promise<GrandTournamentEntry[]> {
    return db.select().from(grandTournamentEntries).where(eq(grandTournamentEntries.tournamentId, tournamentId)).orderBy(desc(grandTournamentEntries.points));
  }

  async getGrandTournamentEntry(id: number): Promise<GrandTournamentEntry | undefined> {
    const [entry] = await db.select().from(grandTournamentEntries).where(eq(grandTournamentEntries.id, id));
    return entry;
  }

  async getGrandTournamentEntryByUser(tournamentId: number, userId: number): Promise<GrandTournamentEntry | undefined> {
    const [entry] = await db.select().from(grandTournamentEntries).where(
      and(eq(grandTournamentEntries.tournamentId, tournamentId), eq(grandTournamentEntries.userId, userId))
    );
    return entry;
  }

  async createGrandTournamentEntry(entry: InsertGrandTournamentEntry): Promise<GrandTournamentEntry> {
    const [created] = await db.insert(grandTournamentEntries).values(entry).returning();
    return created;
  }

  async updateGrandTournamentEntry(id: number, updates: Partial<InsertGrandTournamentEntry>): Promise<GrandTournamentEntry | undefined> {
    const [updated] = await db.update(grandTournamentEntries).set(updates).where(eq(grandTournamentEntries.id, id)).returning();
    return updated;
  }

  async getDistrictBattles(month: string): Promise<DistrictBattle[]> {
    return db.select().from(districtBattles).where(eq(districtBattles.month, month));
  }

  async getDistrictBattle(id: number): Promise<DistrictBattle | undefined> {
    const [battle] = await db.select().from(districtBattles).where(eq(districtBattles.id, id));
    return battle;
  }

  async getDistrictBattleByKey(month: string, eventId: string, district1: string, district2?: string): Promise<DistrictBattle | undefined> {
    if (district2) {
      const [battle] = await db.select().from(districtBattles).where(
        and(eq(districtBattles.month, month), eq(districtBattles.eventId, eventId), eq(districtBattles.district1, district1), eq(districtBattles.district2, district2))
      );
      return battle;
    }
    const [battle] = await db.select().from(districtBattles).where(
      and(eq(districtBattles.month, month), eq(districtBattles.eventId, eventId), eq(districtBattles.district1, district1))
    );
    return battle;
  }

  async createDistrictBattle(battle: InsertDistrictBattle): Promise<DistrictBattle> {
    const [created] = await db.insert(districtBattles).values(battle).returning();
    return created;
  }

  async updateDistrictBattle(id: number, updates: Partial<InsertDistrictBattle>): Promise<DistrictBattle | undefined> {
    const [updated] = await db.update(districtBattles).set(updates).where(eq(districtBattles.id, id)).returning();
    return updated;
  }

  async getGrandTournamentQuestions(activeOnly?: boolean): Promise<GrandTournamentQuestion[]> {
    if (activeOnly) {
      return db.select().from(grandTournamentQuestions).where(eq(grandTournamentQuestions.active, true)).orderBy(desc(grandTournamentQuestions.id));
    }
    return db.select().from(grandTournamentQuestions).orderBy(desc(grandTournamentQuestions.id));
  }

  async createGrandTournamentQuestion(q: InsertGrandTournamentQuestion): Promise<GrandTournamentQuestion> {
    const [created] = await db.insert(grandTournamentQuestions).values(q).returning();
    return created;
  }

  async updateGrandTournamentQuestion(id: number, updates: Partial<InsertGrandTournamentQuestion>): Promise<GrandTournamentQuestion | undefined> {
    const [updated] = await db.update(grandTournamentQuestions).set(updates).where(eq(grandTournamentQuestions.id, id)).returning();
    return updated;
  }

  async deleteGrandTournamentQuestion(id: number): Promise<boolean> {
    const result = await db.delete(grandTournamentQuestions).where(eq(grandTournamentQuestions.id, id)).returning();
    return result.length > 0;
  }

  async getAllCodes(): Promise<RedemptionCode[]> {
    return db.select().from(redemptionCodes).orderBy(desc(redemptionCodes.id));
  }

  async getCode(id: number): Promise<RedemptionCode | undefined> {
    const [code] = await db.select().from(redemptionCodes).where(eq(redemptionCodes.id, id));
    return code;
  }

  async getCodeByCode(code: string): Promise<RedemptionCode | undefined> {
    const [found] = await db.select().from(redemptionCodes).where(
      sql`lower(${redemptionCodes.code}) = lower(${code})`
    );
    return found;
  }

  async createCode(code: InsertRedemptionCode): Promise<RedemptionCode> {
    const [created] = await db.insert(redemptionCodes).values(code).returning();
    return created;
  }

  async updateCode(id: number, updates: Partial<InsertRedemptionCode>): Promise<RedemptionCode | undefined> {
    const [updated] = await db.update(redemptionCodes).set(updates).where(eq(redemptionCodes.id, id)).returning();
    return updated;
  }

  async deleteCode(id: number): Promise<boolean> {
    const result = await db.delete(redemptionCodes).where(eq(redemptionCodes.id, id)).returning();
    return result.length > 0;
  }

  async getCodeRedemption(codeId: number, userId: number): Promise<CodeRedemption | undefined> {
    const [found] = await db.select().from(codeRedemptions).where(
      and(eq(codeRedemptions.codeId, codeId), eq(codeRedemptions.userId, userId))
    );
    return found;
  }

  async createCodeRedemption(codeId: number, userId: number): Promise<CodeRedemption> {
    const [created] = await db.insert(codeRedemptions).values({
      codeId,
      userId,
      redeemedAt: new Date().toISOString(),
    }).returning();
    return created;
  }

  async getCurrentFreeCode(): Promise<RedemptionCode | undefined> {
    const all = await db.select().from(redemptionCodes).where(eq(redemptionCodes.isFree, true)).orderBy(desc(redemptionCodes.id));
    return all.find(c => c.currentUses < c.maxUses);
  }

  async getFreeCodesTotalCount(): Promise<number> {
    const result = await db.select({ maxIndex: sql<number>`coalesce(max(free_code_index), 0)` }).from(redemptionCodes).where(eq(redemptionCodes.isFree, true));
    return Number(result[0]?.maxIndex ?? 0);
  }

  async getSiteMessages(): Promise<SiteMessage[]> {
    return db.select().from(siteMessages).orderBy(desc(siteMessages.id));
  }

  async createSiteMessage(content: string, createdBy: string): Promise<SiteMessage> {
    const [msg] = await db.insert(siteMessages).values({
      content,
      createdBy,
      createdAt: new Date().toISOString(),
      isActive: true,
    }).returning();
    return msg;
  }

  async deleteSiteMessage(id: number): Promise<boolean> {
    const result = await db.delete(siteMessages).where(eq(siteMessages.id, id)).returning();
    return result.length > 0;
  }

  async toggleSiteMessage(id: number, isActive: boolean): Promise<SiteMessage | undefined> {
    const [updated] = await db.update(siteMessages).set({ isActive }).where(eq(siteMessages.id, id)).returning();
    return updated;
  }

  async getOrCreateReferral(userId: number) {
    const existing = await pool.query("SELECT * FROM referrals WHERE user_id = $1 LIMIT 1", [userId]);
    if (existing.rows.length > 0) return existing.rows[0];
    const code = "REF" + Math.random().toString(36).slice(2, 9).toUpperCase();
    const created = await pool.query(
      "INSERT INTO referrals (user_id, code, used_count, created_at) VALUES ($1, $2, 0, $3) RETURNING *",
      [userId, code, new Date().toISOString()]
    );
    return created.rows[0];
  }

  async getReferralByCode(code: string) {
    const result = await pool.query("SELECT * FROM referrals WHERE code = $1 LIMIT 1", [code]);
    return result.rows[0];
  }

  async getReferralUseByUser(referralCode: string, usedByUserId: number) {
    const result = await pool.query(
      "SELECT id FROM referral_uses WHERE referral_code = $1 AND used_by_user_id = $2 LIMIT 1",
      [referralCode, usedByUserId]
    );
    return result.rows[0];
  }

  async createReferralUse(referralCode: string, usedByUserId: number) {
    await pool.query(
      "INSERT INTO referral_uses (referral_code, used_by_user_id, used_at) VALUES ($1, $2, $3)",
      [referralCode, usedByUserId, new Date().toISOString()]
    );
  }

  async incrementReferralUseCount(code: string) {
    await pool.query("UPDATE referrals SET used_count = used_count + 1 WHERE code = $1", [code]);
  }

  async getAdminProposals(): Promise<AdminProposal[]> {
    const rows = await pool.query("SELECT * FROM admin_proposals ORDER BY created_at DESC");
    return rows.rows.map(mapProposalRow) as AdminProposal[];
  }

  async getAdminProposal(id: number): Promise<AdminProposal | undefined> {
    const rows = await pool.query("SELECT * FROM admin_proposals WHERE id = $1", [id]);
    return rows.rows[0] ? mapProposalRow(rows.rows[0]) as AdminProposal : undefined;
  }

  async createAdminProposal(data: InsertAdminProposal): Promise<AdminProposal> {
    const rows = await pool.query(
      `INSERT INTO admin_proposals (created_at, created_by_id, created_by_name, type, target_id, target_name, action_data, description, status, is_small_issue, votes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, '{}') RETURNING *`,
      [data.createdAt, data.createdById, data.createdByName, data.type, data.targetId ?? null, data.targetName ?? null, JSON.stringify(data.actionData ?? {}), data.description, data.isSmallIssue ?? false]
    );
    return mapProposalRow(rows.rows[0]) as AdminProposal;
  }

  async updateAdminProposal(id: number, updates: Partial<AdminProposal>): Promise<AdminProposal | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.votes !== undefined) { fields.push(`votes = $${idx++}`); values.push(JSON.stringify(updates.votes)); }
    if (updates.resolvedById !== undefined) { fields.push(`resolved_by_id = $${idx++}`); values.push(updates.resolvedById); }
    if (updates.resolvedByName !== undefined) { fields.push(`resolved_by_name = $${idx++}`); values.push(updates.resolvedByName); }
    if (updates.resolvedAt !== undefined) { fields.push(`resolved_at = $${idx++}`); values.push(updates.resolvedAt); }
    if (fields.length === 0) return this.getAdminProposal(id);
    values.push(id);
    const rows = await pool.query(`UPDATE admin_proposals SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values);
    return rows.rows[0] ? mapProposalRow(rows.rows[0]) as AdminProposal : undefined;
  }

  async getUltraAdminUser(): Promise<User | undefined> {
    const rows = await pool.query("SELECT * FROM users WHERE is_ultra_admin = true LIMIT 1");
    return rows.rows[0] as User | undefined;
  }

  async setUltraAdmin(newUserId: number, oldUserId?: number): Promise<void> {
    if (oldUserId) {
      await pool.query("UPDATE users SET is_ultra_admin = false WHERE id = $1", [oldUserId]);
    }
    await pool.query("UPDATE users SET is_ultra_admin = true WHERE id = $1", [newUserId]);
  }

  async getSchools(): Promise<School[]> {
    const rows = await pool.query("SELECT * FROM schools ORDER BY created_at DESC");
    return rows.rows as School[];
  }

  async getSchool(id: number): Promise<School | undefined> {
    const rows = await pool.query("SELECT * FROM schools WHERE id = $1", [id]);
    return rows.rows[0] as School | undefined;
  }

  async createSchool(data: InsertSchool): Promise<School> {
    const rows = await pool.query(
      "INSERT INTO schools (name, created_by, created_at) VALUES ($1, $2, $3) RETURNING *",
      [data.name, data.createdBy, data.createdAt]
    );
    return rows.rows[0] as School;
  }

  async deleteSchool(id: number): Promise<void> {
    await pool.query("DELETE FROM schools WHERE id = $1", [id]);
  }

  async updateClass(id: number, updates: Partial<Record<string, unknown>>): Promise<Class | undefined> {
    const COLUMN_MAP: Record<string, string> = { safetySettings: "safety_settings", bannedMembers: "banned_members", name: "name", password: "password", description: "description" };
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const [k, v] of Object.entries(updates)) {
      const col = COLUMN_MAP[k];
      if (!col) continue;
      sets.push(`${col} = $${idx++}`);
      vals.push(typeof v === "object" ? JSON.stringify(v) : v);
    }
    if (sets.length === 0) return undefined;
    vals.push(id);
    const rows = await pool.query(`UPDATE classes SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, vals);
    return rows.rows[0] as Class | undefined;
  }

  async getClasses(schoolId?: number): Promise<Class[]> {
    if (schoolId !== undefined) {
      const rows = await pool.query("SELECT * FROM classes WHERE school_id = $1 ORDER BY created_at DESC", [schoolId]);
      return rows.rows as Class[];
    }
    const rows = await pool.query("SELECT * FROM classes ORDER BY created_at DESC");
    return rows.rows as Class[];
  }

  async getClass(id: number): Promise<Class | undefined> {
    const rows = await pool.query("SELECT * FROM classes WHERE id = $1", [id]);
    return rows.rows[0] as Class | undefined;
  }

  async createClass(data: InsertClass): Promise<Class> {
    const rows = await pool.query(
      "INSERT INTO classes (name, password, school_id, teacher_id, teacher_name, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [data.name, data.password, data.schoolId ?? null, data.teacherId, data.teacherName, data.description ?? "", data.createdAt]
    );
    return rows.rows[0] as Class;
  }

  async deleteClass(id: number): Promise<boolean> {
    const result = await pool.query("DELETE FROM classes WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getClassMembers(classId: number): Promise<User[]> {
    const rows = await pool.query("SELECT * FROM users WHERE class_id = $1 AND is_deleted = false", [classId]);
    return rows.rows as User[];
  }

  private mapFriendship(r: any): Friendship {
    return {
      id: r.id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      receiverId: r.receiver_id,
      receiverName: r.receiver_name,
      status: r.status,
      createdAt: r.created_at,
    };
  }

  async getFriendships(userId: number): Promise<Friendship[]> {
    const rows = await pool.query(
      "SELECT * FROM friendships WHERE sender_id = $1 OR receiver_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return rows.rows.map((r: any) => this.mapFriendship(r));
  }

  async getFriendship(id: number): Promise<Friendship | undefined> {
    const rows = await pool.query("SELECT * FROM friendships WHERE id = $1", [id]);
    return rows.rows[0] ? this.mapFriendship(rows.rows[0]) : undefined;
  }

  async createFriendship(data: InsertFriendship): Promise<Friendship> {
    const rows = await pool.query(
      "INSERT INTO friendships (sender_id, sender_name, receiver_id, receiver_name, status, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [data.senderId, data.senderName, data.receiverId, data.receiverName, data.status ?? "pending", data.createdAt]
    );
    return this.mapFriendship(rows.rows[0]);
  }

  async updateFriendship(id: number, status: string): Promise<Friendship | undefined> {
    const rows = await pool.query("UPDATE friendships SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
    return rows.rows[0] ? this.mapFriendship(rows.rows[0]) : undefined;
  }

  async deleteFriendship(id: number): Promise<boolean> {
    const result = await pool.query("DELETE FROM friendships WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getDirectMessages(userId: number, friendId: number, limit = 100): Promise<DirectMessage[]> {
    const rows = await pool.query(
      `SELECT * FROM direct_messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC LIMIT $3`,
      [userId, friendId, limit]
    );
    return rows.rows.map((r: any) => ({
      id: r.id, senderId: r.sender_id, senderName: r.sender_name,
      receiverId: r.receiver_id, content: r.content, createdAt: r.created_at, isRead: r.is_read,
    }));
  }

  async sendDirectMessage(data: InsertDirectMessage): Promise<DirectMessage> {
    const rows = await pool.query(
      `INSERT INTO direct_messages (sender_id, sender_name, receiver_id, content, created_at, is_read) VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
      [data.senderId, data.senderName, data.receiverId, data.content, data.createdAt]
    );
    const r = rows.rows[0];
    return { id: r.id, senderId: r.sender_id, senderName: r.sender_name, receiverId: r.receiver_id, content: r.content, createdAt: r.created_at, isRead: r.is_read };
  }

  async markMessagesRead(senderId: number, receiverId: number): Promise<void> {
    await pool.query(`UPDATE direct_messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false`, [senderId, receiverId]);
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const rows = await pool.query(`SELECT COUNT(*) as cnt FROM direct_messages WHERE receiver_id = $1 AND is_read = false`, [userId]);
    return parseInt(rows.rows[0]?.cnt || "0", 10);
  }

  async createSuspiciousReport(userId: number, username: string, reason: string, details: string): Promise<void> {
    await pool.query(
      `INSERT INTO suspicious_activity (user_id, username, reason, details, created_at, reviewed) VALUES ($1, $2, $3, $4, $5, false)`,
      [userId, username, reason, details, new Date().toISOString()]
    );
  }

  async getSuspiciousReports(): Promise<{ id: number; userId: number; username: string; reason: string; details: string; createdAt: string; reviewed: boolean }[]> {
    const rows = await pool.query(`SELECT * FROM suspicious_activity ORDER BY created_at DESC LIMIT 200`);
    return rows.rows.map((r: any) => ({ id: r.id, userId: r.user_id, username: r.username, reason: r.reason, details: r.details, createdAt: r.created_at, reviewed: r.reviewed }));
  }

  async markReportReviewed(id: number): Promise<void> {
    await pool.query(`UPDATE suspicious_activity SET reviewed = true WHERE id = $1`, [id]);
  }

  async deleteSuspiciousReport(id: number): Promise<void> {
    await pool.query(`DELETE FROM suspicious_activity WHERE id = $1`, [id]);
  }

  async getWinStreakLeaderboard(limit = 50): Promise<{ id: number; username: string; winStreak: number }[]> {
    const rows = await pool.query(
      "SELECT id, username, win_streak FROM users WHERE is_deleted = false AND banned = false AND win_streak > 0 ORDER BY win_streak DESC LIMIT $1",
      [limit]
    );
    return rows.rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      winStreakPeak: r.win_streak_peak || 0,
      tournamentWinStreakPeak: r.tournament_win_streak_peak || 0,
    }));
  }
}

export const storage = new DatabaseStorage();
