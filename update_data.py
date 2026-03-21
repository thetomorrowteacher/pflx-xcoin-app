import re

with open('/sessions/loving-nice-hopper/mnt/pflx-xcoin-app/app/lib/data.ts', 'r') as f:
    content = f.read()

# ===================================================================
# 1. FILE HEADER COMMENT
# ===================================================================
content = content.replace(
    '// Mock data store for PFLX X-Coin app',
    '// Mock data store for PFLX Digital Badge & X-Coin (XC) app'
)

# ===================================================================
# 2. USER INTERFACE - field renames
# ===================================================================
content = content.replace(
    '  xcoin: number; // Total lifetime X-Coins/Badges earned (never decreases)\n  xp: number;    // Current spendable XP\n  totalXp: number; // Total lifetime XP (used for Rank calculation only)',
    '  digitalBadges: number; // Total lifetime Digital Badges earned (never decreases)\n  xcoin: number;    // Current spendable X-Coin (XC)\n  totalXcoin: number; // Total lifetime XC earned (used for Rank calculation only)'
)

# ===================================================================
# 3. MOCK USERS - rename fields in data
# ===================================================================
# Admin users - xcoin:0, xp:0, totalXp:0 (appears twice)
content = content.replace(
    '    xcoin: 0,\n    xp: 0,\n    totalXp: 0,',
    '    digitalBadges: 0,\n    xcoin: 0,\n    totalXcoin: 0,'
)

# player-1 (xcoin:28, xp:1850, totalXp:8500)
content = content.replace(
    '    xcoin: 28,\n    xp: 1850,\n    totalXp: 8500,',
    '    digitalBadges: 28,\n    xcoin: 1850,\n    totalXcoin: 8500,'
)

# player-2 (xcoin:42, xp:2900, totalXp:12500)
content = content.replace(
    '    xcoin: 42,\n    xp: 2900,\n    totalXp: 12500,',
    '    digitalBadges: 42,\n    xcoin: 2900,\n    totalXcoin: 12500,'
)

# player-3 (xcoin:15, xp:450, totalXp:2100)
content = content.replace(
    '    xcoin: 15,\n    xp: 450,\n    totalXp: 2100,',
    '    digitalBadges: 15,\n    xcoin: 450,\n    totalXcoin: 2100,'
)

# ===================================================================
# 4. TRANSACTION CURRENCY TYPE
# ===================================================================
content = content.replace(
    '  currency: "xcoin" | "xp";',
    '  currency: "xcoin" | "digitalBadge";'
)

# ===================================================================
# 5. MODIFIER EFFECT TYPE - rename string literals
#    Order matters: do xcoin_ first before xp_ becomes xcoin
# ===================================================================
content = content.replace('"xcoin_deduct"', '"badge_deduct"')
content = content.replace('"xcoin_add"', '"badge_add"')
content = content.replace('"xp_deduct"', '"xc_deduct"')
content = content.replace('"xp_add"', '"xc_add"')
content = content.replace('"xp_multiply"', '"xc_multiply"')

# Update effectLabel function map
content = content.replace(
    '    xp_deduct: "Deduct XP",\n    xp_add: "Add XP",\n    xp_multiply: "Multiply XP",\n    xcoin_deduct: "Deduct X-Coin",\n    xcoin_add: "Add X-Coin",',
    '    xc_deduct: "Deduct XC",\n    xc_add: "Add XC",\n    xc_multiply: "Multiply XC",\n    badge_deduct: "Deduct Digital Badge",\n    badge_add: "Add Digital Badge",'
)

# ===================================================================
# 6. PFLX MODIFIER INTERFACE
#    costXcoin -> costBadge first, then costXp -> costXcoin
# ===================================================================
content = content.replace(
    '  costXp: number;      // XP cost to buy (upgrade) OR XP fine amount (tax)\n  costXcoin: number;   // X-Coin cost to buy (upgrade) OR X-Coin fine (tax)',
    '  costXcoin: number;   // XC cost to buy (upgrade) OR XC fine amount (tax)\n  costBadge: number;   // Digital Badge cost (upgrade) OR badge fine (tax)'
)

# Update mockModifiers: replace costXp: N, costXcoin: 0 with costXcoin: N, costBadge: 0
content = re.sub(r'costXp: (\d+), costXcoin: 0', r'costXcoin: \1, costBadge: 0', content)

# ===================================================================
# 7. COIN INTERFACE - xp -> xc
# ===================================================================
content = content.replace(
    'export interface Coin {\n  name: string;\n  description: string;\n  xp: number;\n  image?: string;\n}',
    'export interface Coin {\n  name: string;\n  description: string;\n  xc: number;  // XC reward value for earning this Digital Badge\n  image?: string;\n}'
)

# ===================================================================
# 8. COIN CATEGORIES - rename "Coins" -> "Badges"
# ===================================================================
content = content.replace('"Primary Coins (Behavior)"', '"Primary Badges (Behavior)"')
content = content.replace('"Premium Coins (Achievement)"', '"Premium Badges (Achievement)"')
content = content.replace('"Executive Coins (Jobs)"', '"Executive Badges (Jobs)"')
content = content.replace('"Signature Coins (Skill Mastery)"', '"Signature Badges (Skill Mastery)"')

# ===================================================================
# 9. COIN DATA: xp: NUMBER -> xc: NUMBER
#    Target only standalone "xp: N" (not xpReward, xpAmount, etc.)
# ===================================================================
# Pattern: ", xp: NUMBER" or "xp: NUMBER }" in coin objects
content = re.sub(r', xp: (\d+)\s*\}', r', xc: \1 }', content)

# ===================================================================
# 10. TASK/JOB INTERFACES AND DATA - xpReward -> xcReward
# ===================================================================
content = content.replace(
    '  xpReward: number; // Base/Total XP from the task',
    '  xcReward: number; // Base/Total XC reward from the task'
)
content = content.replace(
    '  xpReward: number; // Base/Total XP from the job',
    '  xcReward: number; // Base/Total XC reward from the job'
)
# In mock task/job data
content = content.replace('    xpReward: ', '    xcReward: ')

# ===================================================================
# 11. PFLX RANK INTERFACE - complete rewrite
# ===================================================================
old_rank_interface = '''export interface PFLXRank {
  level: number;
  name: string;
  requirement: number; // Required XP
  requirementXcoin?: number; // Total X-Coins required
  specificCoinRequirement?: string; // Name of a specific coin required
  icon?: string;
  image?: string; // Support for custom images for Evolution Rankings
}'''

new_rank_interface = '''export interface PFLXRank {
  level: number;
  name: string;
  xcoinUnlock: number;             // XC required to unlock this rank
  xcoinMaintain: number;           // XC required to maintain this rank
  checkpointsRequired: number;     // Number of checkpoints required
  badgeTypeRequirements: string[]; // Badge types needed: "Primary", "Premium", "Executive", "Signature"
  specificBadgeRequirements?: string[]; // Specific named badges required
  icon?: string;
  image?: string; // Custom image for Evolution Rankings
}'''

content = content.replace(old_rank_interface, new_rank_interface)

# ===================================================================
# 12. MOCK PFLX RANKS - full rewrite with spec values
# ===================================================================
old_ranks = '''export let mockPflxRanks: PFLXRank[] = [
  { level: 1, name: "Player", requirement: 0, requirementXcoin: 0, specificCoinRequirement: "", icon: "👤" },
  { level: 2, name: "Advanced Player", requirement: 2500, requirementXcoin: 5, specificCoinRequirement: "", icon: "🛡️" },
  { level: 3, name: "Apprentice", requirement: 5000, requirementXcoin: 15, specificCoinRequirement: "", icon: "🔧" },
  { level: 4, name: "Manager/Head", requirement: 15000, requirementXcoin: 30, specificCoinRequirement: "", icon: "📋" },
  { level: 5, name: "Director/Producer", requirement: 75000, requirementXcoin: 50, specificCoinRequirement: "", icon: "🎬" },
  { level: 6, name: "Mentor/Intern", requirement: 150000, requirementXcoin: 80, specificCoinRequirement: "", icon: "🎓" },
  { level: 7, name: "Associate", requirement: 500000, requirementXcoin: 100, specificCoinRequirement: "", icon: "🏢" },
  { level: 8, name: "Senior", requirement: 750000, requirementXcoin: 150, specificCoinRequirement: "Beacon of Collaboration", icon: "💎" },
  { level: 9, name: "Chief", requirement: 900000, requirementXcoin: 200, specificCoinRequirement: "Beacon of X-Cellence", icon: "🎖️" },
  { level: 10, name: "Partner", requirement: 1000000, requirementXcoin: 250, specificCoinRequirement: "Beacon of Knowledge", icon: "🦅" },
];'''

new_ranks = '''export let mockPflxRanks: PFLXRank[] = [
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
];'''

content = content.replace(old_ranks, new_ranks)

# ===================================================================
# 13. HELPER FUNCTIONS - rename + update logic
# ===================================================================
content = content.replace(
    'export function getLevelFromXP(xp: number): number {\n  return Math.floor(xp / 1000) + 1; // Updated level calculation\n}',
    'export function getLevelFromXC(xcoin: number): number {\n  return Math.floor(xcoin / 1000) + 1; // Level based on XC\n}'
)

content = content.replace(
    'export function getXPToNextLevel(xp: number): number {\n  const currentLevel = getLevelFromXP(xp);\n  return currentLevel * 1000 - xp;\n}',
    'export function getXCToNextLevel(xcoin: number): number {\n  const currentLevel = getLevelFromXC(xcoin);\n  return currentLevel * 1000 - xcoin;\n}'
)

content = content.replace(
    'export function getXPProgress(xp: number): number {\n  const xpInCurrentLevel = xp % 1000;\n  return (xpInCurrentLevel / 1000) * 100;\n}',
    'export function getXCProgress(xcoin: number): number {\n  const xcInCurrentLevel = xcoin % 1000;\n  return (xcInCurrentLevel / 1000) * 100;\n}'
)

# getCurrentRank - use xcoinUnlock
content = content.replace(
    'export function getCurrentRank(totalXp: number): PFLXRank {\n  return [...mockPflxRanks].reverse().find(r => totalXp >= r.requirement) || mockPflxRanks[0] || { level: 1, name: "Player", requirement: 0, icon: "👤" };\n}',
    'export function getCurrentRank(totalXcoin: number): PFLXRank {\n  return [...mockPflxRanks].reverse().find(r => totalXcoin >= r.xcoinUnlock) || mockPflxRanks[0] || { level: 1, name: "Player", xcoinUnlock: 0, xcoinMaintain: 0, checkpointsRequired: 0, badgeTypeRequirements: [], icon: "👤" };\n}'
)

# getRankProgress - use xcoinUnlock
content = content.replace(
    'export function getRankProgress(totalXp: number): number {\n  const current = getCurrentRank(totalXp);\n  const nextIdx = mockPflxRanks.findIndex(r => r.level === current.level) + 1;\n  if (nextIdx >= mockPflxRanks.length) return 100;\n  const next = mockPflxRanks[nextIdx];\n  const range = next.requirement - current.requirement;\n  const progress = totalXp - current.requirement;\n  return (progress / range) * 100;\n}',
    'export function getRankProgress(totalXcoin: number): number {\n  const current = getCurrentRank(totalXcoin);\n  const nextIdx = mockPflxRanks.findIndex(r => r.level === current.level) + 1;\n  if (nextIdx >= mockPflxRanks.length) return 100;\n  const next = mockPflxRanks[nextIdx];\n  const range = next.xcoinUnlock - current.xcoinUnlock;\n  const progress = totalXcoin - current.xcoinUnlock;\n  return (progress / range) * 100;\n}'
)

# ===================================================================
# WRITE OUTPUT
# ===================================================================
with open('/sessions/loving-nice-hopper/mnt/pflx-xcoin-app/app/lib/data.ts', 'w') as f:
    f.write(content)

print('data.ts updated successfully!')
print(f'File size: {len(content)} chars')

# Verify key changes
checks = [
    ('digitalBadges: number;', 'User.digitalBadges field'),
    ('xcoin: number;    // Current spendable X-Coin (XC)', 'User.xcoin (XC) field'),
    ('totalXcoin: number;', 'User.totalXcoin field'),
    ('xcoinUnlock: number;', 'PFLXRank.xcoinUnlock field'),
    ('xcoinMaintain: number;', 'PFLXRank.xcoinMaintain field'),
    ('checkpointsRequired: number;', 'PFLXRank.checkpointsRequired field'),
    ('"Primary Badges (Behavior)"', 'Primary Badges category'),
    ('"Premium Badges (Achievement)"', 'Premium Badges category'),
    ('costXcoin: number;   // XC cost', 'Modifier costXcoin field'),
    ('getLevelFromXC', 'getLevelFromXC function'),
    ('getCurrentRank(totalXcoin', 'getCurrentRank updated'),
    ('xcReward: ', 'xcReward in data'),
    ('"xc_deduct"', 'xc_deduct effect type'),
]

all_ok = True
for check, label in checks:
    if check in content:
        print(f'  OK: {label}')
    else:
        print(f'  MISSING: {label}')
        all_ok = False

if all_ok:
    print('\nAll checks passed!')
else:
    print('\nSome checks failed - review the output above.')
