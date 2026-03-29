// Mock data store for PFLX Digital Badge & X-Coin (XC) app
// In production, this will be wired to Supabase

export type Role = "admin" | "player";

export interface User {
  id: string;
  name: string;
  brandName?: string; // Player identity for others
  role: Role;
  avatar: string;
  digitalBadges: number; // Total lifetime Digital Badges earned (never decreases)
  xcoin: number;    // Current spendable X-Coin (XC)
  totalXcoin: number; // Total lifetime XC earned (used for Rank calculation only)
  level: number;
  rank: number;  // Evolution Rank (1-10)
  cohort: string;
  pathway: string;
  joinedAt: string;
  email?: string; // Player email — used for account claiming & login lookup
  image?: string; // Custom profile image/logo (base64 or URL)
  pin?: string;   // 4-digit login PIN (admin-managed, anonymous to player)
  claimed?: boolean; // Whether the player has claimed their account via email
  isHost?: boolean; // Player granted host (admin) access by the primary host
  badgeCounts?: BadgeBreakdown; // Per-type badge breakdown
  // Startup Studio fields
  studioId?: string;             // Which Startup Studio this player belongs to
  diagnosticComplete?: boolean;  // Whether the player has completed the onboarding diagnostic
  pinChanged?: boolean;          // Whether the player has changed their temp PIN
  brandingComplete?: boolean;    // Whether the player has completed personal branding
  onboardingComplete?: boolean;  // Master flag: pin changed + diagnostic + branding all done
  studioStakeXC?: number;        // XC the player has staked in their studio
  studioStakePercent?: number;   // % stake they hold in studio pool
  diagnosticResult?: DiagnosticResult; // Stored diagnostic results
}


// Badge type breakdown for composite status scoring
export interface BadgeBreakdown {
  signature: number;   // 🟥 Signature Badges (Skill Mastery) — highest weight
  executive: number;   // 🟨 Executive Badges (Jobs)
  premium: number;     // 🟪 Premium Badges (Achievement)
  primary: number;     // 🟦 Primary Badges (Behavior) — lowest weight
}

// Helper: check if user has host-level access (primary admin OR granted isHost)
export function isHostUser(user: User): boolean {
  return user.role === "admin" || user.isHost === true;
}

export interface XPTrade {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface Investment {
  id: string;
  playerId: string;
  targetType: "task" | "job";
  targetId: string;
  amount: number;
  expectedReturn: number;
  status: "pending" | "active" | "completed" | "lost";
  createdAt: string;
}

// Stake from an investor into a specific task/job
export interface InvestorStake {
  investorId: string;
  xpAmount: number;
  stakePercent: number; // % of the effective XP payout going to this investor
}

// Player-to-player investment deal
export interface PlayerDeal {
  id: string;
  investorId: string;       // The higher-rank player providing capital
  targetPlayerId: string;   // The player receiving the investment
  xpStake: number;          // XP invested upfront
  stakePercent: number;     // % of target's future earnings (max 20%)
  terms: string;            // Deal description / terms
  status: "pending" | "active" | "rejected" | "completed" | "buyout_requested";
  createdAt: string;
  totalEarningsTracked: number; // Running total of target's earnings since deal active
  totalReturned: number;        // XP returned to investor so far
  buyoutPrice?: number;         // XP cost to buy out the deal (set when buyout requested)
  buyoutRequestedAt?: string;   // When the buyout was requested
}

export interface RewardCoin {
  coinName: string;
  amount: number;
}

export interface SubmissionProof {
  linkUrl?: string;   // Google Doc, Canva, YouTube, etc.
  fileUrl?: string;   // uploaded file name/path
  note?: string;      // optional note
}

export interface Task {
  id: string;
  title: string;
  description: string;
  rewardCoins: RewardCoin[];
  xcReward: number; // Base/Total XC reward from the task
  dueDate: string;
  status: "open" | "submitted" | "approved" | "rejected";
  submittedBy?: string;
  submittedAt?: string;
  submissionProof?: SubmissionProof;
  createdBy: string;
  createdAt: string;
  category: string;
  roundId?: string; // which checkpoint this task belongs to
  investorStakes?: InvestorStake[]; // XP investments boosting this task's value
  assignedTo?: "all" | string[]; // "all" = everyone, string[] = player IDs or cohort names
  link?: string; // Optional resource link (Google Doc, Canva, YouTube, etc.)
}

export interface Checkpoint {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed";
  assignedTo?: "all" | string[];
  createdBy: string;
  seasonId?: string;    // links this round to a GamePeriod season
  bannerImage?: string; // base64 or URL — displayed as art on round/season cards
  projectIds?: string[]; // Projects included in this checkpoint (auto-pulls their tasks/jobs)
  link?: string; // Optional resource link
}

export interface Job {
  id: string;
  title: string;
  description: string;
  rewardCoins: RewardCoin[];
  xcReward: number; // Base/Total XC reward from the job
  slots: number;
  filledSlots: number;
  status: "open" | "closed";
  createdBy: string;
  createdAt: string;
  applicants: string[];
  approved: string[];
  investorStakes?: InvestorStake[]; // XP investments boosting this job's value
  assignedTo?: "all" | string[]; // "all" = everyone, string[] = player IDs or cohort names
  link?: string; // Optional resource link
}

// Helper: check if a task/job is visible to a given player
export function isAssignedToPlayer(assignedTo: "all" | string[] | undefined, playerId: string, cohort: string): boolean {
  if (!assignedTo || assignedTo === "all") return true;
  return assignedTo.includes(playerId) || assignedTo.includes(cohort);
}

// Get unique cohorts from mockUsers
export function getMockCohorts(): string[] {
  return [...new Set(mockUsers.filter(u => u.role === "player").map(u => u.cohort))];
}

export interface Transaction {
  id: string;
  userId: string;
  type: "earned" | "spent" | "admin_grant" | "pflx_tax" | "investment_return" | "investment_stake";
  amount: number;
  currency: "xcoin" | "digitalBadge";
  description: string;
  createdAt: string;
}

// What game event triggers this modifier automatically
export type ModifierTrigger =
  | "manual"                      // Admin applies manually — no auto-trigger
  | "task_missed_deadline"        // A task is not submitted by its due date
  | "checkpoint_missed_deadline"  // A checkpoint's end date passes without completion
  | "job_missed_deadline"         // A job is not applied to / completed in time
  | "incomplete_submission"       // A submission is rejected for quality issues
  | "task_approved"               // A task is approved by admin (reward trigger)
  | "checkpoint_completed";       // A checkpoint is fully completed

// What the modifier actually does when triggered
export type ModifierEffect =
  | "xc_deduct"       // Deduct flat XP (fine)
  | "xc_add"          // Add flat XP (bonus)
  | "xc_multiply"     // Multiply XP earned by a factor (e.g. 1.1 = +10%)
  | "badge_deduct"    // Deduct X-Coins
  | "badge_add"       // Add X-Coins
  | "deadline_extend" // Extend deadline by N hours
  | "freeze";         // Freeze privileges / bonuses

export interface PFLXModifier {
  id: string;
  type: "upgrade" | "tax";
  name: string;
  description: string;
  costXcoin: number;   // XC cost to buy (upgrade) OR XC fine amount (tax)
  costBadge: number;   // Digital Badge cost (upgrade) OR badge fine (tax)
  duration: string;    // 'single-use', 'permanent', '24h', '1w', 'immediate'
  icon?: string;
  image?: string;
  isCustomImage?: boolean;
  // ── Auto-apply engine ─────────────────────────────────────────
  autoApply?: boolean;              // When true, fires automatically on triggerEvent
  triggerEvent?: ModifierTrigger;   // Which game event fires this
  effectType?: ModifierEffect;      // What effect is applied
  effectValue?: number;             // Flat amount OR multiplier (1.1 = +10%)
  scope?: "task" | "job" | "checkpoint" | "all"; // What entity it targets
  // ── Availability restrictions ───────────────────────────────────
  availableTo?: "all" | "restricted";  // "all" = everyone can see/buy, "restricted" = filtered
  minRank?: number;                     // Minimum Evolution Rank required (1-10)
  maxRank?: number;                     // Maximum rank allowed (for beginner-only items)
  minLevel?: number;                    // Minimum level required
  allowedCohorts?: string[];            // Specific cohort names, empty = all cohorts
  allowedStudios?: string[];            // Specific studio IDs, empty = all studios
}

// Helper: human-readable label for a trigger event
export function triggerLabel(t?: ModifierTrigger): string {
  const map: Record<ModifierTrigger, string> = {
    manual: "Manual",
    task_missed_deadline: "Task Missed Deadline",
    checkpoint_missed_deadline: "Checkpoint Missed Deadline",
    job_missed_deadline: "Job Missed Deadline",
    incomplete_submission: "Incomplete Submission",
    task_approved: "Task Approved",
    checkpoint_completed: "Checkpoint Completed",
  };
  return t ? map[t] : "Manual";
}

// Helper: human-readable label for an effect type
export function effectLabel(e?: ModifierEffect): string {
  const map: Record<ModifierEffect, string> = {
    xc_deduct: "Deduct XC",
    xc_add: "Add XC",
    xc_multiply: "Multiply XC",
    badge_deduct: "Deduct Digital Badge",
    badge_add: "Add Digital Badge",
    deadline_extend: "Extend Deadline (hrs)",
    freeze: "Freeze Privileges",
  };
  return e ? map[e] : "—";
}

export let mockModifiers: PFLXModifier[] = [
  // ── Upgrades ──────────────────────────────────────────────────
  { id: "upg-1", type: "upgrade", name: "72-Hour Extension", description: "Extend any task deadline by 72 hours.", costXcoin: 1500, costBadge: 0, duration: "single-use", icon: "⏳", autoApply: false, triggerEvent: "manual", effectType: "deadline_extend", effectValue: 72, scope: "task" },
  { id: "upg-2", type: "upgrade", name: "Late-Entry Pass", description: "Submit a project after deadline with no penalty.", costXcoin: 2500, costBadge: 0, duration: "single-use", icon: "🎟️", autoApply: false, triggerEvent: "manual", effectType: "deadline_extend", effectValue: 48, scope: "task" },
  { id: "upg-3", type: "upgrade", name: "XC Multiplier", description: "Gain +10% XC on all tasks for 24 hours.", costXcoin: 4000, costBadge: 0, duration: "24h", icon: "🚀", autoApply: false, triggerEvent: "manual", effectType: "xc_multiply", effectValue: 1.1, scope: "all" },
  { id: "upg-4", type: "upgrade", name: "Checkpoint Bonus", description: "Earn +200 bonus XC when a checkpoint is completed on time.", costXcoin: 3000, costBadge: 0, duration: "single-use", icon: "🏁", autoApply: true, triggerEvent: "checkpoint_completed", effectType: "xc_add", effectValue: 200, scope: "checkpoint" },
  { id: "upg-5", type: "upgrade", name: "Task Completion Booster", description: "Earn +50 bonus XC each time a task is approved.", costXcoin: 2000, costBadge: 0, duration: "single-use", icon: "⭐", autoApply: true, triggerEvent: "task_approved", effectType: "xc_add", effectValue: 50, scope: "task" },
  // ── Taxes & Fines ─────────────────────────────────────────────
  { id: "tax-1", type: "tax", name: "Task Deviation", description: "Trigger: Lack of making efficient progress on a task.", costXcoin: 100, costBadge: 0, duration: "immediate", icon: "⚠️", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 100, scope: "task" },
  { id: "tax-2", type: "tax", name: "Temporal Delay", description: "Given for not completing or submitting a Checkpoint Assessment by the deadline.", costXcoin: 300, costBadge: 0, duration: "immediate", icon: "⏳", autoApply: true, triggerEvent: "checkpoint_missed_deadline", effectType: "xc_deduct", effectValue: 300, scope: "checkpoint" },
  { id: "tax-3", type: "tax", name: "Echo Disruption", description: "Disrupting the class environment or not following class procedures.", costXcoin: 500, costBadge: 0, duration: "immediate", icon: "🔊", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 500, scope: "all" },
  { id: "tax-4", type: "tax", name: "Incomplete Submission Tax", description: "Work not meeting rubric or quality standards.", costXcoin: 500, costBadge: 0, duration: "immediate", icon: "✏️", autoApply: true, triggerEvent: "incomplete_submission", effectType: "xc_deduct", effectValue: 500, scope: "task" },
  { id: "tax-5", type: "tax", name: "Accountability Audit", description: "Accumulated fines trigger a system review. Freeze bonuses or privileges for 1 week.", costXcoin: 1000, costBadge: 0, duration: "1w", icon: "🔍", autoApply: false, triggerEvent: "manual", effectType: "freeze", scope: "all" },
  { id: "tax-6", type: "tax", name: "Blackout Zone Fee", description: "Off-task behaviors such as using unauthorized sites or watching unauthorized videos.", costXcoin: 1000, costBadge: 0, duration: "immediate", icon: "⬛", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 1000, scope: "all" },
  { id: "tax-7", type: "tax", name: "Communication Neglect Tax", description: "Non-responsive to team messages or ignoring feedback.", costXcoin: 1000, costBadge: 0, duration: "immediate", icon: "📵", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 1000, scope: "all" },
  { id: "tax-8", type: "tax", name: "Deadline Neglect Tax", description: "Missed due dates without prior notice.", costXcoin: 1000, costBadge: 0, duration: "immediate", icon: "📅", autoApply: true, triggerEvent: "task_missed_deadline", effectType: "xc_deduct", effectValue: 1000, scope: "task" },
  { id: "tax-9", type: "tax", name: "Delinquency Tax – Class I: Minor Breach", description: "A minor inconsistency detected in workflow or participation logs.", costXcoin: 1000, costBadge: 0, duration: "immediate", icon: "❗", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 1000, scope: "all" },
  { id: "tax-10", type: "tax", name: "Event Absence Tax", description: "Missing assigned event duty or production.", costXcoin: 1000, costBadge: 0, duration: "immediate", icon: "🎟️", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 1000, scope: "all" },
  { id: "tax-11", type: "tax", name: "Zero-Gravity Code Violation", description: "Bullying, disrespect, inappropriate language, or negative behavior toward peers.", costXcoin: 3000, costBadge: 0, duration: "immediate", icon: "☄️", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 3000, scope: "all" },
  { id: "tax-12", type: "tax", name: "Delinquency Tax – Class II: Task Default", description: "Multiple incomplete submissions or repeated lapses in deliverables.", costXcoin: 5000, costBadge: 0, duration: "immediate", icon: "📉", autoApply: true, triggerEvent: "incomplete_submission", effectType: "xc_deduct", effectValue: 5000, scope: "task" },
  { id: "tax-13", type: "tax", name: "Delinquency Tax – Class III: Operational Failure", description: "Major project disruption or leadership breakdown recorded.", costXcoin: 10000, costBadge: 0, duration: "immediate", icon: "🔴", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 10000, scope: "all" },
  { id: "tax-14", type: "tax", name: "Delinquency Tax – Class IV: Major Violation", description: "Sustained non-compliance or breach of system integrity protocols.", costXcoin: 50000, costBadge: 0, duration: "immediate", icon: "🚨", autoApply: false, triggerEvent: "manual", effectType: "xc_deduct", effectValue: 50000, scope: "all" },
  { id: "tax-15", type: "tax", name: "Delinquency Tax: Class V — Critical Override", description: "Severe misconduct or total breakdown of assigned responsibilities. All privileges suspended.", costXcoin: 100000, costBadge: 0, duration: "permanent", icon: "☠️", autoApply: false, triggerEvent: "manual", effectType: "freeze", scope: "all" },
  // ── Job fines ─────────────────────────────────────────────────
  { id: "tax-16", type: "tax", name: "Job Abandonment Fine", description: "Player accepted a job but failed to complete it by the deadline.", costXcoin: 800, costBadge: 0, duration: "immediate", icon: "💼", autoApply: true, triggerEvent: "job_missed_deadline", effectType: "xc_deduct", effectValue: 800, scope: "job" },
];

export interface PlayerModifier {
  id: string;
  playerId: string;
  modifierId: string;
  status: "active" | "used" | "expired";
  acquiredAt: string;
  expiresAt?: string;
}

export let mockPlayerModifiers: PlayerModifier[] = [
  { id: "pm-1", playerId: "player-1", modifierId: "upg-1", status: "active", acquiredAt: new Date().toISOString() }
];

export interface PFLXRank {
  level: number;
  name: string;
  xcoinUnlock: number;             // XC required to unlock this rank
  xcoinMaintain: number;           // XC required to maintain this rank
  checkpointsRequired: number;     // Number of checkpoints required
  badgeTypeRequirements: string[]; // Badge types needed: "Primary", "Premium", "Executive", "Signature"
  specificBadgeRequirements?: string[]; // Specific named badges required
  icon?: string;
  image?: string; // Custom image for Evolution Rankings
}

export let mockPflxRanks: PFLXRank[] = [
  {
    level: 1, name: "Player",
    xcoinUnlock: 1000, xcoinMaintain: 0, checkpointsRequired: 0,
    badgeTypeRequirements: ["Signature"],
    specificBadgeRequirements: ["Personal Branding Level 1", "Portfolio Starter", "Design Thinker Level 1", "Digital Citizen Level 1", "PFLX User Certification"],
    icon: "👤"
  },
  {
    level: 2, name: "Advanced Player",
    xcoinUnlock: 5000, xcoinMaintain: 3500, checkpointsRequired: 3,
    badgeTypeRequirements: ["Primary"],
    icon: "🛡️"
  },
  {
    level: 3, name: "Apprentice",
    xcoinUnlock: 15000, xcoinMaintain: 10000, checkpointsRequired: 5,
    badgeTypeRequirements: ["Primary", "Premium"],
    icon: "🔧"
  },
  {
    level: 4, name: "Manager/Head",
    xcoinUnlock: 50000, xcoinMaintain: 35000, checkpointsRequired: 7,
    badgeTypeRequirements: ["Primary", "Premium", "Executive"],
    icon: "📋"
  },
  {
    level: 5, name: "Director/Producer",
    xcoinUnlock: 125000, xcoinMaintain: 90000, checkpointsRequired: 10,
    badgeTypeRequirements: ["Primary", "Premium", "Signature"],
    specificBadgeRequirements: ["Executive Producer", "Creative Director", "Technical Director"],
    icon: "🎬"
  },
  {
    level: 6, name: "Mentor/Intern",
    xcoinUnlock: 250000, xcoinMaintain: 180000, checkpointsRequired: 12,
    badgeTypeRequirements: ["Primary", "Premium", "Executive", "Signature"],
    specificBadgeRequirements: ["Global Digital Intern Level 1"],
    icon: "🎓"
  },
  {
    level: 7, name: "Associate",
    xcoinUnlock: 400000, xcoinMaintain: 300000, checkpointsRequired: 15,
    badgeTypeRequirements: ["Primary", "Premium", "Executive", "Signature"],
    specificBadgeRequirements: ["Global Digital Intern Level 1", "Global Digital Intern Level 2"],
    icon: "🏢"
  },
  {
    level: 8, name: "Senior",
    xcoinUnlock: 600000, xcoinMaintain: 450000, checkpointsRequired: 17,
    badgeTypeRequirements: ["Primary", "Premium", "Executive", "Signature"],
    icon: "💎"
  },
  {
    level: 9, name: "Chief",
    xcoinUnlock: 800000, xcoinMaintain: 600000, checkpointsRequired: 19,
    badgeTypeRequirements: ["Primary", "Premium", "Executive", "Signature"],
    icon: "🎖️"
  },
  {
    level: 10, name: "Partner",
    xcoinUnlock: 1000000, xcoinMaintain: 750000, checkpointsRequired: 20,
    badgeTypeRequirements: ["Primary", "Premium", "Executive", "Signature"],
    icon: "🦅"
  },
];

export interface GamePeriod {
  id: string;
  type: "season"; // Seasons are high-level game arcs; Rounds are managed in Task Management
  title: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  durationString?: string;
  image?: string;
}

export let mockGamePeriods: GamePeriod[] = [
  { id: "s-1", type: "season", title: "Season 1: Origins", isActive: true, startDate: "2024-08-01", endDate: "2024-12-15", durationString: "1st Semester" },
  { id: "s-2", type: "season", title: "Season 2: The Ascent", isActive: false, startDate: "2025-01-06", endDate: "2025-05-30", durationString: "2nd Semester" },
];

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface CoinSubmission {
  id: string;
  playerId: string;
  coinType: string;
  amount: number;
  reason: string;
  evidenceUrl?: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  feedback?: string;
}

export interface Coin {
  name: string;
  description: string;
  xc: number;  // XC reward value for earning this Digital Badge
  image?: string;
  // Residual income / course sponsorship
  sponsorType?: "player" | "studio" | "none"; // Who sponsors this course/project
  sponsorId?: string;       // Player ID or Studio ID of the sponsor
  sponsorName?: string;     // Display name (cached for UI)
  residualPercent?: number; // % of XC reward paid to sponsor on each badge earn (default 10%)
}

export interface CoinCategory {
  name: string;
  coins: Coin[];
}

export const COIN_CATEGORIES: CoinCategory[] = [
  {
    name: "Primary Badges (Behavior)",
    coins: [
      { name: "Battle Arena Champion", description: "Awarded to Players or Teams who win a Battle Arena event within PFLX.", xc: 300 },
      { name: "Self Directed Player", description: "Independently completing a complex task using the 'First Line of Defense' without support.", xc: 200 },
      { name: "Strategic Organizer", description: "Awarded for organizing tasks, tools, or objectives to complete work efficiently.", xc: 100 },
      { name: "Entrepreneurial Spirit", description: "Demonstrating initiative, problem solving, and risk-taking within PFLX activities.", xc: 100 },
      { name: "Self Advocate", description: "Awarded for confidently expressing needs, asking for help, and taking ownership of personal growth.", xc: 100 },
      { name: "Focus Optimizer", description: "Awarded for staying focused and minimizing distractions during learning activities.", xc: 100 },
      { name: "Gamification Guru", description: "Using/boosting the PFLX Platform by ideating new functions and concepts for the gamification of PFLX.", xc: 100 },
      { name: "Professional Communicator", description: "Clear, kind, effective speaking or writing within a professional situation.", xc: 100 },
      { name: "Critical Thinker", description: "Asking strong questions or proposing thoughtful solutions.", xc: 100 },
      { name: "Master Collaborator", description: "Positive teamwork and inclusive collaboration.", xc: 100 },
      { name: "Innovative Creator", description: "Generating creative ideas or unique contributions.", xc: 100 },
      { name: "Digital Tool Master", description: "Effectively using required apps or tools independently.", xc: 100 },
      { name: "Resilient Learner", description: "Actively pushing through challenges to engage in learning.", xc: 100 },
      { name: "Growth Mindset", description: "Demonstrating perseverance when challenges arise.", xc: 100 },
      { name: "Goal Setter", description: "Setting and sharing daily/weekly goals with clear intent.", xc: 100 },
      { name: "Time Manager", description: "Completing tasks on time.", xc: 100 },
      { name: "Peer Supporter", description: "Helping a classmate understand a concept or catch up.", xc: 100 },
      { name: "Positive Participant", description: "Consistent participation in class activities and discussions.", xc: 100 },
      { name: "Digital Citizen", description: "Using devices responsibly, showing online etiquette.", xc: 100 },
      { name: "Emerging Leader", description: "A Common Coin given for taking initiative, guiding peers, or contributing positively to group dynamics.", xc: 100 },
    ]
  },
  {
    name: "Premium Badges (Achievement)",
    coins: [
      { name: "Beacon of Knowledge", description: "A Rare Coin for demonstrating deep understanding worth 1,000 XC.", xc: 1000 },
      { name: "Beacon of Creativity", description: "A Rare Coin for original and innovative thinking.", xc: 750 },
      { name: "Beacon of X-Cellence", description: "A Rare Coin for delivering high-quality work.", xc: 750 },
      { name: "Beacon of Collaboration", description: "A Rare Coin given for outstanding teamwork worth 500 XC.", xc: 500 },
    ]
  },
  {
    name: "Executive Badges (Jobs)",
    coins: [
      { name: "Executive Producer", description: "Oversees full project lifecycle, budget management, and team hiring.", xc: 1000 },
      { name: "Creative Director", description: "Leads creative vision, storytelling, and visual branding across stages.", xc: 1000 },
      { name: "Director of Photography", description: "Manages camera work, shot composition, and lighting quality.", xc: 1000 },
      { name: "Project Manager", description: "Tracks workflow, timelines, logistics, and team task management.", xc: 1000 },
      { name: "Lead Editor", description: "Oversees post-production workflow and editing team management.", xc: 1000 },
      { name: "Technical Director", description: "Manages live event technical execution (audio, staging, lighting).", xc: 650 },
      { name: "Stage Manager", description: "Oversees stage transitions and set management during events.", xc: 600 },
      { name: "Video Editor", description: "Producing and editing high-quality video content for media campaigns.", xc: 500 },
      { name: "Studio Director", description: "Directs talent during filming, ensuring timing and energy.", xc: 500 },
      { name: "Lighting Technician", description: "Operates and manages lighting during productions.", xc: 500 },
      { name: "Host/Anchor/Actor", description: "Role as a host, anchor, actor, or voiceover talent.", xc: 350 },
      { name: "Camera Operator", description: "Operated a Camera device to capture production footage.", xc: 250 },
    ]
  },
  {
    name: "Signature Badges (Skill Mastery)",
    coins: [
      { name: "Cert: Photoshop", description: "Industry certification achievement.", xc: 5000, sponsorType: "player" as const, sponsorId: "player-1", sponsorName: "PixelQueen", residualPercent: 10 },
      { name: "Cert: Premiere", description: "Industry certification achievement.", xc: 5000, sponsorType: "player" as const, sponsorId: "player-2", sponsorName: "MotionMaster", residualPercent: 12 },
      { name: "Master Builder", description: "Exceptional mastery of pathway tools.", xc: 5000, sponsorType: "player" as const, sponsorId: "player-1", sponsorName: "PixelQueen", residualPercent: 8 },
    ]
  }
];

// Mock Users
export let mockUsers: User[] = [
  {
    id: "admin-0",
    name: "PrototypeFLX",
    brandName: "PrototypeFLX",
    role: "admin",
    avatar: "PF",
    digitalBadges: 0,
    xcoin: 0,
    totalXcoin: 0,
    level: 99,
    rank: 10,
    cohort: "N/A",
    pathway: "Host",
    joinedAt: "2024-01-01",
    email: "host@prototypeflx.com",
    pin: "0000",
    claimed: true,
  },
  {
    id: "admin-1",
    name: "Mr. Johnson",
    brandName: "TheTomorrowTeacher",
    role: "admin",
    avatar: "MJ",
    digitalBadges: 0,
    xcoin: 0,
    totalXcoin: 0,
    level: 99,
    rank: 10,
    cohort: "N/A",
    pathway: "Host",
    joinedAt: "2024-08-01",
    email: "ennisjohnsonjr@thetomorrowteacher.org",
    pin: "1111",
    claimed: true,
  },
  {
    id: "player-1",
    name: "Alex Rivera",
    brandName: "PixelProphet",
    role: "player",
    avatar: "AR",
    digitalBadges: 28,
    xcoin: 1850,
    totalXcoin: 8500,
    level: 9,
    rank: 3,
    cohort: "Cohort 2",
    pathway: "Digital Design",
    joinedAt: "2024-08-15",
    email: "alex.rivera@school.edu",
    pin: "3847",
    claimed: true,
    diagnosticComplete: true,
    studioId: "studio-emagination",
    badgeCounts: { signature: 1, executive: 4, premium: 3, primary: 20 },
    diagnosticResult: {
      brandType: "creative-director",
      topPathways: ["Digital Design", "Content Creator", "Web Dev"],
      style: "futuristic",
      scores: { maker: 72, visionary: 85, storyteller: 78, technologist: 65 },
      visionStatement: {
        create: "I create visually stunning digital experiences that push the boundaries of design.",
        impact: "My work empowers communities to see the world differently through bold creative expression.",
        perspective: "I believe the future belongs to those who dare to imagine it first.",
        future: "I will build a brand that bridges art, technology, and culture.",
      },
      completedAt: "2024-09-10",
    },
  },
  {
    id: "player-2",
    name: "Jordan Lee",
    brandName: "MotionMaster",
    role: "player",
    avatar: "JL",
    digitalBadges: 42,
    xcoin: 2900,
    totalXcoin: 12500,
    level: 13,
    rank: 4,
    cohort: "Cohort 3",
    pathway: "Content Creator",
    joinedAt: "2024-08-15",
    email: "jordan.lee@school.edu",
    pin: "5291",
    claimed: false,
    diagnosticComplete: true,
    studioId: "studio-gentech",
    badgeCounts: { signature: 2, executive: 6, premium: 4, primary: 30 },
    diagnosticResult: {
      brandType: "digital-innovator",
      topPathways: ["Content Creator", "Game Designer", "Digital Design"],
      style: "dynamic",
      scores: { maker: 68, visionary: 90, storyteller: 88, technologist: 74 },
      visionStatement: {
        create: "I create motion-driven content that captures attention and tells powerful stories.",
        impact: "My work inspires the next generation to express themselves through digital media.",
        perspective: "I believe authentic storytelling is the most powerful tool in the digital age.",
        future: "I will become a leading voice in youth media and digital entertainment.",
      },
      completedAt: "2024-09-12",
    },
  },
  {
    id: "player-3",
    name: "Sam Chen",
    brandName: "CodeCrafter",
    role: "player",
    avatar: "SC",
    digitalBadges: 15,
    xcoin: 450,
    totalXcoin: 2100,
    level: 4,
    rank: 2,
    cohort: "Cohort 2",
    pathway: "Web Dev",
    joinedAt: "2024-09-01",
    email: "sam.chen@school.edu",
    pin: "7063",
    claimed: false,
    diagnosticComplete: true,
    studioId: "studio-innov8",
    badgeCounts: { signature: 0, executive: 2, premium: 2, primary: 11 },
    diagnosticResult: {
      brandType: "technical-builder",
      topPathways: ["Web Dev", "Game Designer", "Content Creator"],
      style: "minimal",
      scores: { maker: 91, visionary: 70, storyteller: 55, technologist: 95 },
      visionStatement: {
        create: "I create clean, functional digital products that solve real problems for real people.",
        impact: "My work makes technology accessible and intuitive for every kind of learner.",
        perspective: "I believe the best designs are invisible — they just work.",
        future: "I will build the tools and platforms that power the next generation of creators.",
      },
      completedAt: "2024-09-15",
    },
  },
];


// Get badge breakdown for a player (uses stored badgeCounts if available)
export function getBadgeBreakdown(user: User): BadgeBreakdown {
  if (user.badgeCounts) return user.badgeCounts;
  return { signature: 0, executive: 0, premium: 0, primary: 0 };
}

// Composite Status Score — determines leaderboard position
// Weights: Evolution Rank > Signature > Executive > Premium > Primary > XC (tiebreaker)
export function getStatusScore(user: User): number {
  const rankLevel = getCurrentRank(user.totalXcoin, user).level;
  const b = getBadgeBreakdown(user);
  return (
    rankLevel     * 100000 +
    b.signature   * 10000  +
    b.executive   * 1000   +
    b.premium     * 100    +
    b.primary     * 10     +
    Math.floor(user.xcoin / 100)
  );
}

// Helper: generate a random 4-digit PIN
export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Mock Trades
export const mockTrades: XPTrade[] = [
  {
    id: "trade-1",
    fromId: "player-1",
    toId: "player-2",
    amount: 150,
    note: "Help with Premiere transitions",
    status: "pending",
    createdAt: "2026-03-15",
  }
];

// Mock Investments
export const mockInvestments: Investment[] = [
  {
    id: "inv-1",
    playerId: "player-2",
    targetType: "task",
    targetId: "task-1",
    amount: 300,
    expectedReturn: 360,
    status: "active",
    createdAt: "2026-03-14",
  }
];

// Mock Task Rounds
export let mockCheckpoints: Checkpoint[] = [
  {
    id: "round-1",
    name: "Q1 Design Sprint",
    description: "Core design fundamentals — logos, prototypes, and visual identity.",
    startDate: "2026-03-01",
    endDate: "2026-03-21",
    status: "active",
    assignedTo: "all",
    createdBy: "admin-1",
    seasonId: "s-2",
  },
  {
    id: "round-2",
    name: "Content Creator Sprint",
    description: "Storytelling, reels, blog writing, and social media strategy.",
    startDate: "2026-03-22",
    endDate: "2026-04-11",
    status: "upcoming",
    assignedTo: "all",
    createdBy: "admin-1",
    seasonId: "s-2",
  },
  {
    id: "round-past-1",
    name: "Orientation Round",
    description: "Intro tasks to get players set up with tools and profiles.",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    status: "completed",
    assignedTo: "all",
    createdBy: "admin-1",
    seasonId: "s-1",
  },
];

// Mock Tasks
export let mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Design a Logo for Class Brand",
    description: "Create a professional logo for the PFLX Digital Design class brand. Submit as a PNG file with transparent background.",
    rewardCoins: [{ coinName: "Self Advocate", amount: 1 }],
    xcReward: 100, // Matching the 100 XP from Self Advocate
    dueDate: "2026-03-20",
    status: "open",
    createdBy: "admin-1",
    createdAt: "2026-03-10",
    category: "Design",
    assignedTo: "all",
    roundId: "round-1",
  },
  {
    id: "task-2",
    title: "Create a 60-Second Reel",
    description: "Produce a 60-second social media reel showcasing your pathway project. Must include music, transitions, and captions.",
    rewardCoins: [{ coinName: "Content Creator", amount: 2 }],
    xcReward: 500,
    dueDate: "2026-03-18",
    status: "submitted",
    submittedBy: "player-1",
    submittedAt: "2026-03-12",
    createdBy: "admin-1",
    createdAt: "2026-03-05",
    category: "Content",
    assignedTo: "all",
    roundId: "round-1",
  },
  {
    id: "task-3",
    title: "Complete Adobe Illustrator Quiz",
    description: "Take the Adobe Illustrator fundamentals quiz on Canvas and score 80% or higher.",
    rewardCoins: [{ coinName: "Tech Savvy", amount: 1 }],
    xcReward: 100,
    dueDate: "2026-03-15",
    status: "approved",
    submittedBy: "player-2",
    submittedAt: "2026-03-10",
    submissionProof: { linkUrl: "https://canvas.example.com/quiz/123", note: "Scored 92%" },
    createdBy: "admin-1",
    createdAt: "2026-03-01",
    category: "Quiz",
    assignedTo: "all",
    roundId: "round-past-1",
  },
  {
    id: "task-4",
    title: "Build a Figma Prototype",
    description: "Design and prototype a mobile app concept using Figma. Minimum 5 screens with working interactions.",
    rewardCoins: [{ coinName: "Design Specialist", amount: 1 }],
    xcReward: 450,
    dueDate: "2026-03-25",
    status: "open",
    createdBy: "admin-1",
    createdAt: "2026-03-13",
    category: "Design",
    assignedTo: "all",
    roundId: "round-1",
  },
  {
    id: "task-5",
    title: "Write a Blog Post",
    description: "Write a 500-word blog post about your creative process this semester. Post on the class blog.",
    rewardCoins: [{ coinName: "Professional Communicator", amount: 1 }], // Added rewardCoins for task-5
    xcReward: 150,
    dueDate: "2026-03-19",
    status: "submitted",
    submittedBy: "player-4",
    submittedAt: "2026-03-13",
    createdBy: "admin-1",
    createdAt: "2026-03-08",
    category: "Writing",
    assignedTo: "all",
    roundId: "round-1",
  },
];

// Mock Jobs
export let mockJobs: Job[] = [
  {
    id: "job-1",
    title: "Class Social Media Manager",
    description: "Manage the class Instagram and TikTok accounts for 2 weeks. Post 3x per week with approved content.",
    rewardCoins: [
      { coinName: "Content Creator", amount: 2 },
      { coinName: "Social Media Manager", amount: 1 } 
    ],
    xcReward: 1200,
    slots: 2,
    filledSlots: 1,
    status: "open",
    createdBy: "admin-1",
    createdAt: "2026-03-01",
    applicants: ["player-1", "player-3"],
    approved: ["player-1"],
    assignedTo: "all",
  },
  {
    id: "job-2",
    title: "Equipment Room Assistant",
    description: "Help manage and organize the equipment room. Check in/out cameras and audio gear for classmates.",
    rewardCoins: [
      { coinName: "Resource Manager", amount: 1 }
    ],
    xcReward: 800,
    slots: 1,
    filledSlots: 1,
    status: "closed",
    createdBy: "admin-1",
    createdAt: "2026-02-15",
    applicants: ["player-2", "player-5"],
    approved: ["player-2"],
    assignedTo: "all",
  },
  {
    id: "job-3",
    title: "Peer Tutor — Adobe Creative Suite",
    description: "Help fellow players with Photoshop, Illustrator, and Premiere Pro. Must have Level 10+.",
    rewardCoins: [
      { coinName: "Creative Mentor", amount: 1 }
    ],
    xcReward: 1500,
    slots: 3,
    filledSlots: 0,
    status: "open",
    createdBy: "admin-1",
    createdAt: "2026-03-10",
    applicants: ["player-4"],
    approved: [],
    assignedTo: "all",
  },
];

// Mock Transactions
export let mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    userId: "player-1",
    type: "earned",
    amount: 75,
    currency: "xcoin",
    description: "Task approved: Create a 60-Second Reel",
    createdAt: "2026-03-12",
  },
  {
    id: "tx-2",
    userId: "player-2",
    type: "earned",
    amount: 30,
    currency: "xcoin",
    description: "Task approved: Adobe Illustrator Quiz",
    createdAt: "2026-03-10",
  },
  {
    id: "tx-3",
    userId: "player-4",
    type: "earned",
    amount: 150,
    currency: "xcoin",
    description: "Job completed: Equipment Room Assistant",
    createdAt: "2026-03-01",
  },
  {
    id: "tx-4",
    userId: "player-1",
    type: "admin_grant",
    amount: 50,
    currency: "xcoin",
    description: "Bonus: Outstanding class participation",
    createdAt: "2026-03-05",
  },
];

export let mockSubmissions: CoinSubmission[] = [
  {
    id: "sub-1",
    playerId: "player-1",
    coinType: "Collaborator",
    amount: 1,
    reason: "Helped Jordan with their project setup",
    status: "approved",
    submittedAt: "2024-09-10",
    reviewedAt: "2024-09-11",
  },
  {
    id: "sub-2",
    playerId: "player-2",
    coinType: "Problem Solver",
    amount: 2,
    reason: "Fixed a critical bug in the class repo",
    status: "pending",
    submittedAt: "2024-09-15",
  },
];

export function getLevelFromXC(xcoin: number): number {
  return Math.floor(xcoin / 1000) + 1; // Level based on XC
}

export function getXCToNextLevel(xcoin: number): number {
  const currentLevel = getLevelFromXC(xcoin);
  return currentLevel * 1000 - xcoin;
}

export function getXCProgress(xcoin: number): number {
  const xcInCurrentLevel = xcoin % 1000;
  return (xcInCurrentLevel / 1000) * 100;
}

// ── Rank eligibility: checks XC + checkpoints + badge types + specific badges ──

/** Count how many checkpoints a player has completed (tasks approved in completed rounds) */
export function getPlayerCheckpointsCompleted(playerId: string): number {
  const completedRounds = mockCheckpoints.filter(cp => cp.status === "completed");
  let count = 0;
  for (const round of completedRounds) {
    // A player "completed" a checkpoint if they have at least one approved task in that round
    const hasTasks = mockTasks.some(
      t => t.roundId === round.id && t.status === "approved" && (
        t.assignedTo === "all" ||
        (Array.isArray(t.assignedTo) && t.assignedTo.includes(playerId)) ||
        t.submittedBy === playerId
      )
    );
    if (hasTasks) count++;
  }
  return count;
}

/** Get a player's earned badge names from approved submissions */
export function getPlayerEarnedBadgeNames(playerId: string): string[] {
  return mockSubmissions
    .filter(s => s.playerId === playerId && s.status === "approved")
    .map(s => s.coinType);
}

/** Check if a player has at least one badge from a given type category */
function playerHasBadgeType(badgeCounts: BadgeBreakdown | undefined, typeName: string): boolean {
  if (!badgeCounts) return false;
  const map: Record<string, keyof BadgeBreakdown> = {
    "Primary": "primary",
    "Premium": "premium",
    "Executive": "executive",
    "Signature": "signature",
  };
  const key = map[typeName];
  return key ? (badgeCounts[key] ?? 0) > 0 : false;
}

/** Full rank calculation — evaluates ALL requirements, not just XC */
export function getCurrentRank(totalXcoin: number, user?: User): PFLXRank {
  // If no user context provided, fall back to XC-only check (backward compat)
  if (!user) {
    return [...mockPflxRanks].reverse().find(r => totalXcoin >= r.xcoinUnlock) || mockPflxRanks[0];
  }

  const checkpointsCompleted = getPlayerCheckpointsCompleted(user.id);
  const earnedBadgeNames = getPlayerEarnedBadgeNames(user.id);

  // Walk ranks from highest to lowest, return the first one where ALL requirements are met
  for (let i = mockPflxRanks.length - 1; i >= 0; i--) {
    const rank = mockPflxRanks[i];

    // 1. XC requirement
    if (totalXcoin < rank.xcoinUnlock) continue;

    // 2. Checkpoints requirement
    if (checkpointsCompleted < rank.checkpointsRequired) continue;

    // 3. Badge type requirements — must have at least 1 badge in each required type
    const badgeTypeMet = rank.badgeTypeRequirements.every(
      type => playerHasBadgeType(user.badgeCounts, type)
    );
    if (!badgeTypeMet) continue;

    // 4. Specific badge requirements — must have each named badge
    if (rank.specificBadgeRequirements && rank.specificBadgeRequirements.length > 0) {
      const specificMet = rank.specificBadgeRequirements.every(
        name => earnedBadgeNames.includes(name)
      );
      if (!specificMet) continue;
    }

    return rank;
  }

  // No rank requirements met — default to level 1
  return mockPflxRanks[0];
}

/** Detailed breakdown of what requirements are met/unmet for a given rank */
export interface RankRequirementStatus {
  rank: PFLXRank;
  xcMet: boolean;
  xcCurrent: number;
  checkpointsMet: boolean;
  checkpointsCurrent: number;
  badgeTypesMet: boolean;
  badgeTypesDetail: { type: string; met: boolean; count: number }[];
  specificBadgesMet: boolean;
  specificBadgesDetail: { name: string; met: boolean }[];
  allMet: boolean;
}

/** Get requirement status for a specific rank */
export function getRankRequirements(rank: PFLXRank, user: User): RankRequirementStatus {
  const checkpointsCurrent = getPlayerCheckpointsCompleted(user.id);
  const earnedBadgeNames = getPlayerEarnedBadgeNames(user.id);

  const xcMet = user.totalXcoin >= rank.xcoinUnlock;
  const checkpointsMet = checkpointsCurrent >= rank.checkpointsRequired;

  const badgeTypesDetail = rank.badgeTypeRequirements.map(type => {
    const map: Record<string, keyof BadgeBreakdown> = { "Primary": "primary", "Premium": "premium", "Executive": "executive", "Signature": "signature" };
    const key = map[type];
    const count = key && user.badgeCounts ? (user.badgeCounts[key] ?? 0) : 0;
    return { type, met: count > 0, count };
  });
  const badgeTypesMet = badgeTypesDetail.every(d => d.met);

  const specificBadgesDetail = (rank.specificBadgeRequirements || []).map(name => ({
    name,
    met: earnedBadgeNames.includes(name),
  }));
  const specificBadgesMet = specificBadgesDetail.every(d => d.met);

  return {
    rank,
    xcMet, xcCurrent: user.totalXcoin,
    checkpointsMet, checkpointsCurrent,
    badgeTypesMet, badgeTypesDetail,
    specificBadgesMet, specificBadgesDetail,
    allMet: xcMet && checkpointsMet && badgeTypesMet && specificBadgesMet,
  };
}

export function getRankProgress(totalXcoin: number, user?: User): number {
  const current = getCurrentRank(totalXcoin, user);
  const nextIdx = mockPflxRanks.findIndex(r => r.level === current.level) + 1;
  if (nextIdx >= mockPflxRanks.length) return 100;
  const next = mockPflxRanks[nextIdx];
  const range = next.xcoinUnlock - current.xcoinUnlock;
  const progress = totalXcoin - current.xcoinUnlock;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

// Calculate how much XP the target player must pay to buy out a deal
// Formula: 120% of unrecovered principal (stake - returned), minimum 100 XP
export function getBuyoutPrice(deal: PlayerDeal): number {
  const unrecovered = Math.max(0, deal.xpStake - deal.totalReturned);
  return Math.max(100, Math.ceil(unrecovered * 1.2));
}

// Returns a suggested stake % based on investment size (1% per 100 XP, capped at 20%)
export function getSuggestedStakePercent(xpAmount: number): number {
  return Math.min(20, Math.max(1, Math.floor(xpAmount / 100)));
}

// Calculate XP boost multiplier from investor stakes (max +50% boost)
export function getInvestmentBoostMultiplier(stakes: InvestorStake[] = []): number {
  const totalInvested = stakes.reduce((sum, s) => sum + s.xpAmount, 0);
  const boostPercent = Math.min(50, Math.floor(totalInvested / 200)); // +1% per 200 XP invested
  return 1 + (boostPercent / 100);
}

// Player-to-player investment deals
export let mockPlayerDeals: PlayerDeal[] = [
  {
    id: "deal-1",
    investorId: "player-2",       // Jordan Lee (Rank 4: Manager)
    targetPlayerId: "player-3",   // Sam Chen (Rank 2: Advanced Player)
    xpStake: 500,
    stakePercent: 5,
    terms: "Investing 500 XC in Sam's development. In return, 5% of all future task and job earnings for this season.",
    status: "pending",
    createdAt: "2026-03-16",
    totalEarningsTracked: 0,
    totalReturned: 0,
  }
];

// ─────────────────────────────────────────────────────────────────
// STARTUP STUDIOS SYSTEM
// ─────────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  brandType: "technical-builder" | "creative-director" | "experience-designer" | "digital-innovator";
  topPathways: string[];        // e.g. ["digital-artist", "content-creator", "game-designer"]
  style: string;                // e.g. "futuristic"
  scores: {
    maker: number;
    visionary: number;
    storyteller: number;
    technologist: number;
  };
  visionStatement?: {
    create?: string;
    impact?: string;
    perspective?: string;
    future?: string;
  };
  completedAt: string;
}

export interface StartupStudio {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  image?: string;          // Optional logo image (base64 or URL)
  color: string;           // Accent hex color e.g. "#ef4444"
  colorRgb: string;        // For rgba usage e.g. "239,68,68"
  description: string;
  themes: string[];        // Key themes
  corePathways: string[];  // Pathway IDs this studio attracts
  visualAesthetic: string;
  // Economy
  xcPool: number;          // Total XC in this studio's investment pool
  corporateTaxRate: number; // % deducted from pool each season (e.g. 0.1 = 10%)
  lastTaxAt?: string;
  // Members (player IDs)
  members: string[];
  // Studio-level projects/jobs (IDs adopted by this studio)
  adoptedProjectIds?: string[];
  adoptedJobIds?: string[];
  adoptedTaskIds?: string[];
}

export interface StudioInvestment {
  id: string;
  playerId: string;
  studioId: string;
  stakeXC: number;           // XC staked
  stakePercent: number;      // % share of studio pool this stake represents
  status: "active" | "withdrawn";
  createdAt: string;
  earnedReturn?: number;     // XC earned from studio pool growth
}

// PROJECT — a grouping of tasks and/or jobs with its own identity
export interface Project {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "archived";
  taskIds: string[];         // Task IDs that belong to this project
  jobIds: string[];          // Job IDs that belong to this project
  createdBy: string;
  createdAt: string;
  dueDate?: string;
  assignedTo?: "all" | string[];
  studioId?: string;         // If adopted by a studio
  xcRewardPool?: number;     // Total XC available if project fully completed
  image?: string;
  link?: string; // Optional resource link
}

// ─── Mock Startup Studios ────────────────────────────────────────
export let mockStartupStudios: StartupStudio[] = [
  {
    id: "studio-mindforge",
    name: "MindForge Studios",
    tagline: "Fueling Purpose. Forging Identity.",
    icon: "🧠",
    color: "#94a3b8",
    colorRgb: "148,163,184",
    description: "MindForge is the powerhouse of diversity, identity, and social impact. Brands here are rooted in culture, representation, and personal truth.",
    themes: ["Diversity", "Inclusion", "Identity", "Heritage", "Empowerment"],
    corePathways: ["content-creator", "digital-artist", "sound-designer"],
    visualAesthetic: "Bold colors, symbolic design, cultural fusion",
    xcPool: 18400,
    corporateTaxRate: 0.10,
    members: [],
    adoptedProjectIds: [],
    adoptedJobIds: [],
  },
  {
    id: "studio-emagination",
    name: "eMagination Studios",
    tagline: "Where Ideas Come to Life.",
    icon: "🦅",
    color: "#2563eb",
    colorRgb: "37,99,235",
    description: "eMagination celebrates creativity, storytelling, and world-building. This is where art meets imagination, and fantasy meets production.",
    themes: ["Storytelling", "Animation", "Fiction", "Fantasy", "Play"],
    corePathways: ["content-creator", "digital-artist", "game-designer", "sound-designer"],
    visualAesthetic: "Colorful, whimsical, expressive, character-driven",
    xcPool: 22750,
    corporateTaxRate: 0.10,
    members: [],
    adoptedProjectIds: [],
    adoptedJobIds: [],
  },
  {
    id: "studio-gentech",
    name: "GenTech Studios",
    tagline: "Invent the Future. Solve the Now.",
    icon: "⚛️",
    color: "#06b6d4",
    colorRgb: "6,182,212",
    description: "Gentech is the engine of logic, innovation, and technical excellence. The builders, coders, and system designers who solve real problems.",
    themes: ["Engineering", "Research", "Coding", "Tech Development"],
    corePathways: ["computer-programmer", "game-designer", "3d-modeler"],
    visualAesthetic: "Clean, minimal, functional, high-tech",
    xcPool: 31200,
    corporateTaxRate: 0.10,
    members: [],
    adoptedProjectIds: [],
    adoptedJobIds: [],
  },
  {
    id: "studio-innov8",
    name: "Innov8 Studios",
    tagline: "Explore the Unknown. Build What's Next.",
    icon: "💡",
    color: "#9333ea",
    colorRgb: "147,51,234",
    description: "Innov8 leads the charge into speculative futures, AI, immersive media, and experimental design. They dare to ask 'What if?' and build the answer.",
    themes: ["Futurism", "AI", "Mixed Reality", "Simulation", "Transmedia"],
    corePathways: ["3d-modeler", "game-designer", "computer-programmer"],
    visualAesthetic: "Neon noir, glitchcore, cyberpunk, minimalist futurism",
    xcPool: 27600,
    corporateTaxRate: 0.10,
    members: [],
    adoptedProjectIds: [],
    adoptedJobIds: [],
  },
];

// ─── Mock Studio Investments ────────────────────────────────────
export let mockStudioInvestments: StudioInvestment[] = [
  {
    id: "sinv-1",
    playerId: "player-1",
    studioId: "studio-emagination",
    stakeXC: 500,
    stakePercent: 2.2,
    status: "active",
    createdAt: "2026-03-10",
    earnedReturn: 45,
  },
  {
    id: "sinv-2",
    playerId: "player-2",
    studioId: "studio-emagination",
    stakeXC: 1200,
    stakePercent: 5.3,
    status: "active",
    createdAt: "2026-03-08",
    earnedReturn: 112,
  },
];

// ─── Mock Projects ───────────────────────────────────────────────
export let mockProjects: Project[] = [
  {
    id: "proj-1",
    title: "Brand Identity Campaign",
    description: "Full brand identity package: logo, style guide, and social media launch assets.",
    status: "active",
    taskIds: ["task-1", "task-4"],
    jobIds: ["job-1"],
    createdBy: "admin-1",
    createdAt: "2026-03-10",
    dueDate: "2026-03-31",
    assignedTo: "all",
    xcRewardPool: 2500,
  },
  {
    id: "proj-2",
    title: "Content Sprint S1",
    description: "60-second reels, blog posts, and social presence across platforms.",
    status: "active",
    taskIds: ["task-2", "task-5"],
    jobIds: [],
    createdBy: "admin-1",
    createdAt: "2026-03-05",
    dueDate: "2026-03-25",
    assignedTo: "all",
    xcRewardPool: 1800,
  },
];

// ─── Studio Assignment Algorithm ─────────────────────────────────
// Maps diagnostic results → one of the 4 Startup Studios
export function assignStudioFromDiagnostic(result: DiagnosticResult): string {
  const studioScores: Record<string, number> = {
    "studio-mindforge": 0,
    "studio-emagination": 0,
    "studio-gentech": 0,
    "studio-innov8": 0,
  };

  // Pathway → studio affinity matrix
  const pathwayMatrix: Record<string, Record<string, number>> = {
    "content-creator":    { "studio-mindforge": 3, "studio-emagination": 3, "studio-gentech": 0, "studio-innov8": 1 },
    "digital-artist":     { "studio-mindforge": 3, "studio-emagination": 2, "studio-gentech": 0, "studio-innov8": 1 },
    "sound-designer":     { "studio-mindforge": 2, "studio-emagination": 3, "studio-gentech": 0, "studio-innov8": 2 },
    "game-designer":      { "studio-mindforge": 0, "studio-emagination": 2, "studio-gentech": 2, "studio-innov8": 3 },
    "computer-programmer":{ "studio-mindforge": 0, "studio-emagination": 0, "studio-gentech": 3, "studio-innov8": 2 },
    "3d-modeler":         { "studio-mindforge": 0, "studio-emagination": 1, "studio-gentech": 2, "studio-innov8": 3 },
  };

  // Score by top pathways (weighted: 1st = ×3, 2nd = ×2, 3rd = ×1)
  result.topPathways.slice(0, 3).forEach((pathway, i) => {
    const weight = 3 - i;
    const affinities = pathwayMatrix[pathway] || {};
    Object.entries(affinities).forEach(([studio, pts]) => {
      studioScores[studio] += pts * weight;
    });
  });

  // Storyteller vs Technologist axis
  if (result.scores.storyteller > result.scores.technologist) {
    studioScores["studio-mindforge"] += 4;
    studioScores["studio-emagination"] += 4;
  } else {
    studioScores["studio-gentech"] += 4;
    studioScores["studio-innov8"] += 4;
  }

  // Within storyteller: MindForge (identity/advocacy) vs eMagination (worlds/fantasy)
  if (result.scores.storyteller >= result.scores.technologist) {
    const visionCreate = result.visionStatement?.create || "";
    const isImpactDriven = /divers|cultur|justic|equit|community|impact|voice|change/i.test(visionCreate);
    if (isImpactDriven || result.brandType === "creative-director") {
      studioScores["studio-mindforge"] += 3;
    } else {
      studioScores["studio-emagination"] += 3;
    }
  }

  // Within tech: Gentech (build/execute) vs Innov8 (speculative/visionary)
  if (result.scores.technologist >= result.scores.storyteller) {
    if (result.scores.visionary > result.scores.maker || result.brandType === "digital-innovator") {
      studioScores["studio-innov8"] += 3;
    } else {
      studioScores["studio-gentech"] += 3;
    }
  }

  // Return studio with highest score
  return Object.entries(studioScores).sort(([, a], [, b]) => b - a)[0][0];
}

// AI-powered studio assignment from vision statement text alone (for skip/manual-entry flow)
export function assignStudioFromVisionText(visionText: string): string {
  const text = visionText.toLowerCase();
  const studioScores: Record<string, number> = {
    "studio-mindforge": 0,
    "studio-emagination": 0,
    "studio-gentech": 0,
    "studio-innov8": 0,
  };

  // MindForge: identity, culture, advocacy, community impact, diverse voices
  const mindforgeKeywords = /divers|cultur|justic|equit|community|impact|voice|change|heritage|social|advo|empower|represent|inclus|amplif|underrepresent/;
  // eMagination: fantasy, worlds, storytelling, immersive, wonder, narrative
  const emaginationKeywords = /stor|world|imagin|immers|wonder|fantasy|character|narrat|creat|dream|inspir|emotion|joy|art|visual|design|experience/;
  // GenTech: build, code, solve, execute, systems, apps, practical
  const gentechKeywords = /build|code|program|app|system|solv|execut|practic|tool|develop|engin|web|software|implement|automat/;
  // Innov8: future, innovate, AI, XR, cutting-edge, speculative, pioneer
  const innov8Keywords = /futur|innovat|ai\b|xr\b|vr\b|ar\b|pioneer|cutting|boundar|technolog|possibl|speculat|frontier|robot|machine|next.gen/;

  if (mindforgeKeywords.test(text)) studioScores["studio-mindforge"] += 5;
  if (emaginationKeywords.test(text)) studioScores["studio-emagination"] += 5;
  if (gentechKeywords.test(text)) studioScores["studio-gentech"] += 5;
  if (innov8Keywords.test(text)) studioScores["studio-innov8"] += 5;

  // Tiebreaker: score by word-count density of each keyword set
  const mfCount = (text.match(mindforgeKeywords) || []).length;
  const emCount = (text.match(emaginationKeywords) || []).length;
  const gtCount = (text.match(gentechKeywords) || []).length;
  const i8Count = (text.match(innov8Keywords) || []).length;
  studioScores["studio-mindforge"] += mfCount;
  studioScores["studio-emagination"] += emCount;
  studioScores["studio-gentech"] += gtCount;
  studioScores["studio-innov8"] += i8Count;

  // Default fallback: eMagination (most general creative)
  if (Object.values(studioScores).every(v => v === 0)) {
    studioScores["studio-emagination"] = 1;
  }

  return Object.entries(studioScores).sort(([, a], [, b]) => b - a)[0][0];
}

// Max stake % a player can hold based on their Evo Rank level
export function getStudioMaxStakePercent(rankLevel: number): number {
  if (rankLevel <= 2) return 5;
  if (rankLevel <= 4) return 10;
  if (rankLevel <= 6) return 20;
  if (rankLevel <= 8) return 35;
  return 50; // Level 9-10
}

// Get stake abilities unlocked at a given rank level
export function getStudioRankAbilities(rankLevel: number): string[] {
  const abilities: string[] = ["View studio pool", "Stake XC (up to 5%)"];
  if (rankLevel >= 3) abilities.push("Stake up to 10%", "Vote on Studio project adoption");
  if (rankLevel >= 5) abilities.push("Stake up to 20%", "Nominate players for Studio roles");
  if (rankLevel >= 7) abilities.push("Stake up to 35%", "Propose corporate tax adjustments");
  if (rankLevel >= 9) abilities.push("Stake up to 50%", "Studio co-ownership privileges", "Override Studio project assignments");
  return abilities;
}

// Calculate a player's current return from studio pool growth
export function getStudioReturn(studioId: string, stakePercent: number): number {
  const studio = mockStartupStudios.find(s => s.id === studioId);
  if (!studio) return 0;
  return Math.floor((studio.xcPool * stakePercent) / 100 * 0.05); // 5% annual-ish return on staked portion
}
