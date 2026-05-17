# Neuronix

## Overview
Neuronix is an educational website for children aged 9-13, combining science learning with interactive video game modes. Its purpose is to make STEM subjects fun and accessible, fostering an early interest in science through engaging arcade-style gameplay. The project aims to provide a unique, interactive learning experience that educates and entertains.

## User Preferences
- Kid-friendly, encouraging language throughout
- Large buttons, high contrast colors
- No chat features, no external links
- Mute button always available

## System Architecture
The application is built using a modern web stack designed for an engaging user experience and robust functionality.

### UI/UX Design
The design features a vibrant arcade aesthetic with a primary color palette of purple, blue, green, and orange. The Oxanium font is used to enhance the arcade theme. Animations are powered by Framer Motion, and UI components are built with Shadcn UI.

### Technical Implementation
-   **Frontend**: React.js with Tailwind CSS for styling.
-   **Backend**: Express.js for server-side logic and API handling.
-   **Database**: PostgreSQL with Drizzle ORM for data persistence.
-   **Local Storage**: User progression data is stored locally using LocalStorage to maintain user privacy.

### Core Features
-   **Worlds**: 10 themed exploration worlds, each with unique games, bosses, shop items, and badges. Worlds unlock progressively based on player achievements.
-   **Game Modes**: 25+ game types including runner, matching, sorting, memory, defense, clicker, launcher, maze, gravity_maze, space_invaders, sequence, chain_reaction, reaction_tap, word_scramble, catch_falling, pipe_puzzle, slider_match, and more. No single game type appears more than 4 times across all worlds. GamePlayer component handles reward submission internally and displays XP/coins/badges earned on the result screen. Parents use `skipRewardSubmit` prop when they handle their own submission (e.g., LobbyPage for PvP).
-   **Boss Battles**: Includes regular, secret, and world bosses with multi-phase combat and mutation systems, offering unique rewards.
-   **Lab Experiments**: Interactive science experiments with live visualizations.
-   **Progression System**: XP/level progression, a coin/XP economy, and collectible badges. Rebirth system resets coins, game scores, tournament wins/rankings, common/uncommon shop items, lab progress, and boss progress in exchange for permanent multiplier boosts. Tournament wins are tracked per user. Higher rebirths progressively require more varied conditions: bosses defeated (rebirth 3+), longest streak (rebirth 4+), total XP (rebirth 5+), daily challenges completed (rebirth 6+), and coins on hand (rebirth 8+).
-   **In-Game Shop**: Offers a wide array of cosmetic items (avatars, decorations, themes, frames, mouse followers, etc.), power-ups, and currency upgrades. Shop items and gem upgrades can be refunded from the existing shop UI for 50% of their original currency, excluding earned reward items and equipped avatars. Gem Upgrades include both consumable (per-use) and permanent upgrades. Permanent gem upgrades: Golden Profile, Diamond Profile, XP Mastery (+15% XP), Coin Mastery (+15% coins), Daily Gems (+2 gems on daily rewards), Rainbow Name, Auto Streak Protector (never lose streaks), Treasure Hunter (+5-15 bonus coins per game), Elite Border, Science Star (+10% XP and coins). Permanent upgrades cannot be re-purchased once owned. Backend enforces level requirements for gated upgrades.
-   **VIP System**: Admins/ultra-admins can grant VIP status to players via the Admin Panel. VIP players receive a `✦ VIP` amber badge on all leaderboard rows (individual + tournament), +10% XP, and +10% coins from all games. VIP status is toggled via `POST /api/admin/users/:id/toggle-vip`. The old purchasable `upgrade-vip-leaderboard` gem upgrade has been removed. `is_vip boolean` column on `users` table.
-   **Daily Rewards & Mystery Boxes**: Systems for rewarding daily engagement and providing random item drops.
-   **Currencies**: Coins and Gems used for in-game purchases.
-   **Powerups**: Consumable items that provide in-game advantages.
-   **Player Interaction**:
    -   **Trade Center**: Player-to-player item and coin trading with an escrow system.
    -   **Community Hub**: Users can create, share, and play community-generated question packs.
    -   **1v1 PvP Quiz Duels**: Real-time quiz challenges between players with optional wagers and bot fallback.
-   **Engagement Features**:
    -   **Daily Challenges**: API-backed challenges with completion tracking.
    -   **Leaderboards**: Displays user rankings across five tabs: Individual (sorted by XP/coins/gems/badges/items), Clans, Teams, Win Streaks, and Tournaments. Tournament tab (`GET /api/leaderboard/tournaments`) ranks players by `tournamentXp`. VIP players show a `✦ VIP` badge on all individual and tournament rows.
    -   **Multiplayer Lobby**: Supports multiplayer gameplay with bot integration.
    -   **Tournaments**: Individual and team-based tournaments with various game modes and formats, offering significant rewards. Tournament XP system with 12 named tiers (Rookie Scientist → Cosmic Genius). Matchmaking pairs players by tournament tier proximity. Tournament XP awarded on all tournament submissions (individual, team, grand tournament matches for both players). Rankings page at `/tournament-rankings` shows tier progress, all tiers, and top 100 leaderboard. Submit-time gives participation XP/coins/tournamentXP; final rank-based rewards (gems, champion items, badges, tournamentWins) are distributed ONLY when the tournament auto-completes (endTime passes). This prevents duplicate reward distribution from provisional rankings.
    -   **1v1 Duel Tournaments**: Admins can create `gameMode: "duel"` tournaments. Duel tournaments are individual elimination brackets: players are paired two at a time, both play the same quiz round, the higher score advances, and odd entrants receive automatic byes. Brackets are stored in the existing `tournaments.bracket` JSONB field and reuse `tournament_entries` for round state.
    -   **Grand Tournament**: Monthly round-robin championship with districts for Year 3-8. Features group stages (W/D/L soccer scoring), knockout brackets, 6 events (3 individual + 3 team), and massive prizes (5000 coins + 50 gems + 500 XP for champions). Auto-generates each month. Stored in `grand_tournaments` and `grand_tournament_entries` tables. Questions are admin-manageable via `grand_tournament_questions` table (Admin Panel → GT Questions tab). Admins can add/edit/delete/toggle questions with categories. When 5+ active admin questions exist, they replace the hardcoded defaults. Public API: GET `/api/gt-questions/active`. Admin APIs: GET/POST/PUT/DELETE under `/api/admin/gt-questions`.
    -   **District Battles**: Three types of district competitions stored in `district_battles` table: (1) District vs District - districts fight rival districts with combined scores, (2) Internal Battles - players within a district compete for champion, (3) Grand District Showdown - top 5 players from each district's internal battles qualify and fight for the ultimate crown. Auto-generates monthly with 6 VS pairs, 2 internal events per district, and 1 grand showdown.
    -   **Clan Battles**: Clan-versus-clan matchup system featuring mini science quizzes.
    -   **Leader Elections**: In-game election system for clans and teams. Clan/team owners can start kick votes, but removal requires every eligible member to approve; the owner and the targeted member are excluded from the vote.
-   **Advanced Boss Mechanics**:
    -   **Boss Mutation System**: Bosses evolve with increasing difficulty and new abilities.
    -   **Boss Skills System**: Omega-level bosses possess unique skills that alter gameplay.
    -   **Battle Powerups**: Consumable power-ups (Shield, Time Freeze, Double Damage, Heal, Mirror Shield, Quick Draw) usable in boss fights and PvP duels. Consumed on use, buy more from shop with gems.
-   **Customization**:
    -   **Mouse Followers**: Canvas-based particle effects that follow the cursor.
    -   **Screen Decorations**: Various CSS-based visual effects for the UI.
    -   **Item Card Animations**: Subtle animations on shop item cards.
    -   **Theme System**: Extensive theming capabilities, including world-specific and leaderboard-exclusive themes that override UI variables.
-   **World-Specific Labs**: 10 exclusive lab experiments tied to themed worlds (Ocean Depths, Volcanic Core, Frozen Tundra, Jungle Canopy, Space Station, Crystal Caverns, Storm Citadel, Cyber Grid, Dino Valley, Quantum Realm) with custom animated visualizations and world filter UI.
-   **Safety System**: SafetyPage (`/safety`) explains why Neuronix is safe (8 info cards) + personal safety toggles for logged-in users. Teachers with a class see Class Safety Controls to enforce settings for all students with a lock mechanism. 7 toggleable flags: `hideLeaderboard`, `disableMultiplayer`, `hideTrade`, `hideCommunityPacks`, `hideNews`, `hideClans`, `focusMode` (focus hides all social at once). Stored as JSONB `safety_settings` on `users` and `classes` tables. `PATCH /api/user/safety` (personal), `PATCH /api/classes/:id/safety` (teacher). Class overrides with a `locked` array (student cannot change locked keys). `/api/user` response includes `classSafetySettings` (fetched from class at response time, zero extra API calls). Navbar filters hidden paths computed by `useSafety()` hook — zero extra fetches.
-   **Schools & Districts System**: Teachers and students have distinct roles set at registration. A joined school represents the user's app-wide school app, and the joined class is presented to users as their district. Ultra admins create schools from the Admin Panel (Schools tab). Teachers join a school on the Districts page, then create districts with a password. Students join a district by entering the password. Teacher district admins can view the join password, kick students, and delete their district. `POST /api/schools/:id/join` sets teacher's schoolId. `GET /api/classes/:id/password` (teacher only). `DELETE /api/classes/:id/members/:userId` (teacher/admin kick). `DELETE /api/schools/:id` (admin only). School creation restricted to admins only.
-   **Administrative Tools**: Features for user management, content approval, and reward granting.
    -   **Admin Parliament System**: All major admin actions (ban, strike, reset-progress, delete, permanent-delete, toggle-admin) require a formal proposal submitted to Parliament. Admins vote Yes/No with comments. The Ultra Admin (Speaker) has final say to approve or reject any proposal; approval immediately executes the action. Minor actions (clear-strikes, etc.) are flagged as small issues and can be approved by the Speaker alone. Resolved proposals are preserved as history.
    -   **Ultra Admin Transfer**: The Ultra Admin (Speaker) can transfer their status to any existing admin via Parliament tab → "Transfer Speaker Role". The new holder is stored in `users.is_ultra_admin` DB column and the in-memory `ULTRA_ADMIN_USERNAME` variable in routes.ts is updated immediately.
    -   **Proposals stored in** `admin_proposals` table (JSONB votes field). Routes: `GET/POST /api/admin/proposals`, `POST /api/admin/proposals/:id/vote`, `POST /api/admin/proposals/:id/resolve`, `POST /api/admin/transfer-ultra-admin`.
    -   **Feedback Management**: Admin can mark feedback as read, reward users (+50 XP, +25 coins via `POST /api/admin/feedback/:id/approve`), or delete feedback (`DELETE /api/admin/feedback/:id`).
-   **High Scores Per Difficulty**: Game scores are stored both as overall (`gameId`) and per-difficulty (`gameId:easy`, `gameId:medium`, `gameId:hard`) keys in the `gameScores` JSONB. The game result endpoint returns a `highScores` object with all three difficulty bests + overall. GamePlayer result screen shows difficulty-specific best scores.
-   **Arcade Game Tournaments**: Admins can create tournaments with `gameMode: "arcade"` — selecting a specific arcade game. Players view the tournament, click "Play Now", play the game via GamePlayer inline, and their best score is auto-submitted to `POST /api/tournaments/:id/arcade-score`. Players can replay to beat their own score. Leaderboard shows all participants sorted by score.
-   **Dynamic Home Page Stats**: All front page stat cards (Game Modes, Boss Battles, Badges, Worlds) are calculated dynamically from GAME_MODES, BOSS_BATTLES, BADGES, WORLDS arrays in gameData.ts — no hardcoded numbers.
-   **Schools & Classes**: Teachers can create schools and classes (password-protected). Students join via class code/password. Class leaderboard at `/api/leaderboard/class/:classId`. Schema: `schools` and `classes` tables; `users.isTeacher`, `users.classId`, `users.schoolId` columns. Frontend at `/classes` (ClassesPage) accessible via Navbar.
-   **Rarer Gems**: Mystery box gem chances reduced — bronze 10%→3%, silver 20%→8%, gold 25%→10%. Boss battle gem reward reduced 5→2. Gems are now more prestigious and harder to obtain.
-   **Lava-Escape Zero Gravity**: The lava-escape runner game detects `gameId === "lava-escape"` and applies zero gravity mode (no gravity constant, velocity damping 0.88x per frame). Players control up/down with arrow keys and mobile Up/Down buttons. A "Zero Gravity!" HUD label displays. All other runner games unchanged.
-   **PvP Scores on Arcade**: PvP Trivia Duel wins now update each player's `gameScores["pvp-trivia"]` high score so their PvP performance appears on the Arcade leaderboard.
-   **Item Upgrades**: Owned items in categories `powerup`, `upgrade`, and `battle_powerup` can be upgraded up to Level 2. Level 1 costs 200 coins, Level 2 costs 500 coins. Upgrades stored in `users.itemLevels` JSONB. Route: `POST /api/shop/upgrade-item/:itemId`. ItemCard shows Upgrade button (when owned + below max) and a level badge (when upgraded). Upgrade bonuses by type:
    - **Battle Powerups** (boss battles & PvP): Heal Potion (25→40→60 HP), Mirror Shield (10→20→30 boss dmg), Double Damage (2x→3x→4x), Shield Potion (1→2→3 hits blocked), Poison Strike (5/turn 3 turns→7/turn 4 turns→10/turn 5 turns), Quick Draw (+50%→+75%→+100% bonus).
    - **Consumable Upgrades** (gem upgrades): Each purchase grants 1 extra use per upgrade level (Lv0=1 use, Lv1=2 uses, Lv2=3 uses). Time Extender is reported and consumed after game completion. Boss Rush and Boss Insight are consumed after successful boss fights.
    - **Lucky Answer Powerup**: Uses per game increase with level (Lv0=1, Lv1=2, Lv2=3 uses). Button shows remaining uses count when upgraded.
    - **Music**: Global background/game music is generated in-browser with the Web Audio API instead of stored media files. A single `GlobalMusicController` owns playback and stops the previous loop before starting another, so menu/game music cannot overlap. The existing mute toggle disables it. Route/game-specific presets provide louder, distinct themes for home/auth, bosses, labs, tournaments, social areas, shops/profile/redeem, leaderboard/badges, news/feedback, settings/teacher, admin, and arcade game categories without external media or AI calls.
    - **Year-Level Difficulty**: Arcade speed-quiz games, multiplayer arcade launches, arcade tournaments, and tournament quiz rounds use the user's saved `yearLevel`. Tournament play mixes in year-targeted questions and adjusts time/penalty pressure by year level.
    - **Lab Science Corrections**: Lab simulations prioritize factual ordering and wording: density tower displays least dense at top and densest at bottom; lightning uses a real air-breakdown-style MV/m threshold; fossil dating is limited to carbon-14-appropriate once-living samples; lava viscosity includes crystal content; rainforest layer labels run floor to emergent; fusion threshold matches the 100M+ °C explanation; magnetic field text avoids overstated inverse-square wording.

## External Dependencies
-   **PostgreSQL**: The primary relational database for all application data.
-   **Drizzle ORM**: Used for object-relational mapping to interact with PostgreSQL.
-   **LocalStorage**: Utilized for client-side storage of user progress and settings, avoiding server-side personal data collection.