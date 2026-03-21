import re
import os

BASE = '/sessions/loving-nice-hopper/mnt/pflx-xcoin-app/app'

def patch(filepath, replacements):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        print(f'  NOT FOUND: {filepath}')
        return False
    original = content
    for old, new in replacements:
        if hasattr(old, 'sub'):  # regex
            content = old.sub(new, content)
        else:
            content = content.replace(old, new)
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'  Updated: {filepath}')
        return True
    else:
        print(f'  No change: {filepath}')
        return False

# ── Common renames applied across ALL pages ──────────────────────
# ORDER MATTERS:
#  1) Coin field first (.coin.xp -> .coin.xc, coinDef.xp -> coinDef.xc)
#  2) .xcoin -> .digitalBadges  (old badge count)
#  3) .totalXp -> .totalXcoin
#  4) .xp -> .xcoin              (old spending XP -> new XC)
#  5) xpReward -> xcReward
#  6) costXp -> costXcoin        (modifier cost)
#  7) Function renames
#  8) String / display text

COMMON_RENAMES = [
    # --- Coin field renames (must come before user.xp rename) ---
    ('coin.xp', 'coin.xc'),
    ('coinDef.xp', 'coinDef.xc'),
    ('grantTarget.coin.xc', 'grantTarget.coin.xc'),  # already done above, no-op safety

    # --- User badge count: .xcoin -> .digitalBadges ---
    # (word boundary: won't match .xcoinMaintain, .xcoinUnlock)
    (re.compile(r'\.xcoin\b'), '.digitalBadges'),

    # --- totalXp -> totalXcoin ---
    ('.totalXp', '.totalXcoin'),
    ('totalXp:', 'totalXcoin:'),    # object key
    ('totalXp,', 'totalXcoin,'),    # trailing comma
    ('totalXp}', 'totalXcoin}'),    # closing brace
    ('totalXp )', 'totalXcoin )'),   # closing paren with space

    # --- User spending XP: .xp -> .xcoin ---
    (re.compile(r'\.xp\b'), '.xcoin'),
    # form.xp pattern
    ('form.xcoin', 'form.xcoin'),   # no-op safety after above rename

    # --- xpReward -> xcReward ---
    ('xpReward', 'xcReward'),

    # --- costXp -> costXcoin (modifier cost field) ---
    ('costXp', 'costXcoin'),

    # --- Function renames ---
    ('getLevelFromXP', 'getLevelFromXC'),
    ('getXPProgress', 'getXCProgress'),
    ('getXPToNextLevel', 'getXCToNextLevel'),

    # --- Import updates (data field renames) ---
    ('getXPProgress,', 'getXCProgress,'),
    ('getLevelFromXP,', 'getLevelFromXC,'),

    # --- currency "xp" -> "xcoin" in transactions ---
    ('currency: "xp"', 'currency: "xcoin"'),

    # --- Display text renames ---
    # XP labels -> XC
    (' XP</span>', ' XC</span>'),
    (' XP</p>', ' XC</p>'),
    (' XP</div>', ' XC</div>'),
    (' XP</b>', ' XC</b>'),
    (' XP</li>', ' XC</li>'),
    (' XP</', ' XC</'),
    (' XP`', ' XC`'),
    (' XP.', ' XC.'),
    (' XP!', ' XC!'),
    (' XP )', ' XC )'),
    (' XP)', ' XC)'),
    (' XP earned', ' XC earned'),
    (' XP · ', ' XC · '),
    (' XP\n', ' XC\n'),
    ('"XP"', '"XC"'),
    ("'XP'", "'XC'"),
    ('⚡ XP:', '⚡ XC:'),
    ('XP Required:', 'XC Required:'),
    ('XP:', 'XC:'),
    ('> XP', '> XC'),
    ('/ 1000 XP', '/ 1000 XC'),
    ('Total XP', 'Total XC'),
    ('total XP', 'total XC'),
    ('TOTAL XP', 'TOTAL XC'),

    # X-Coin display labels -> Digital Badge
    ('X-Coin badges', 'Digital Badges'),
    ('X-Coin', 'Digital Badge'),
    ('x-coin', 'digital badge'),
    ('XCOIN', 'XC'),
    ('xcoin', 'xc'),  # for 'XCOIN' in display strings - after field rename already done above
]

# ── Per-file patches ──────────────────────────────────────────────

FILES = {
    # Admin pages
    f'{BASE}/admin/players/page.tsx': COMMON_RENAMES + [
        # form field references
        ('value={form.xcoin}', 'value={form.digitalBadges}'),
        ('value={form.xp}', 'value={form.xcoin}'),  # after common rename .xp -> .xcoin
        # local type uses
        ('User, mockUsers, getLevelFromXP, getCurrentRank', 'User, mockUsers, getLevelFromXC, getCurrentRank'),
    ],
    f'{BASE}/admin/coins/page.tsx': COMMON_RENAMES + [
        # Badge grant logic
        ('targetPlayer.digitalBadges = (targetPlayer.digitalBadges || 0) + grantTarget.amount',
         'targetPlayer.digitalBadges = (targetPlayer.digitalBadges || 0) + grantTarget.amount'),  # no-op
        # coins page imports
        ('getLevelFromXP', 'getLevelFromXC'),
    ],
    f'{BASE}/admin/leaderboard/page.tsx': COMMON_RENAMES + [
        # import line
        ('import { User, mockUsers, getCurrentRank, getXPProgress, getMockCohorts, isHostUser }',
         'import { User, mockUsers, getCurrentRank, getXCProgress, getMockCohorts, isHostUser }'),
        # sort by options: keep "xp" as sort key value (it's now totalXcoin)
        # Display labels in sort buttons
        ('"xp"', '"xcoin"'),
        # Bar value
        ('sortBy === "xcoin" ? b.totalXcoin - a.totalXcoin', 'sortBy === "xcoin" ? b.totalXcoin - a.totalXcoin'),  # no-op
    ],
    f'{BASE}/admin/approvals/page.tsx': COMMON_RENAMES + [
        # import
        ('getLevelFromXP, getInvestmentBoostMultiplier', 'getLevelFromXC, getInvestmentBoostMultiplier'),
        # Deal fields (xpStake, xpAmount are on PlayerDeal/InvestorStake - leave for now)
        # XP display in UI
        ('⚡ {target?.xcoin.toLocaleString()}', '⚡ {target?.xcoin.toLocaleString()}'),  # no-op
        ('Base pool: ⚡ {project.xcReward} XP', 'Base pool: ⚡ {project.xcReward} XC'),
        ('⚡ {t.xcReward}', '⚡ {t.xcReward}'),  # no-op
        ('⚡ +{t.xcReward}', '⚡ +{t.xcReward}'),  # no-op
    ],
    f'{BASE}/admin/page.tsx': COMMON_RENAMES + [
        # ViolationPicker type signature - update costXp (already done by COMMON)
        # totalXCoin (local variable - just a label)
        ('totalXCoin', 'totalDigitalBadges'),
        # Fix "totalXcoin" local var name that already got renamed
        ('totalXcoin', 'totalXcoin'),  # no-op
        # Display
        ('🪙{p.digitalBadges}', '🪙{p.digitalBadges}'),
        ('+{coinDef.xc.toLocaleString()} XP)', '+{coinDef.xc.toLocaleString()} XC)'),
        ('+{coinDef.xc.toLocaleString()} XC)', '+{coinDef.xc.toLocaleString()} XC)'),  # no-op safety
        # XP → XC in coin grant option display
        ('(+{coin.xc.toLocaleString()} XP)', '(+{coin.xc.toLocaleString()} XC)'),
        ('(+{coin.xc.toLocaleString()} XC)', '(+{coin.xc.toLocaleString()} XC)'),  # no-op
        # tax total label
        ('totalXcoin', 'totalXcoin'),
    ],
    f'{BASE}/admin/modifiers/page.tsx': COMMON_RENAMES + [
        # Local interface definition
        ('  costXp: number;', '  costXcoin: number;'),
        # effectType display
        ('xp_deduct', 'xc_deduct'),
        ('xp_add', 'xc_add'),
        ('xp_multiply', 'xc_multiply'),
        ('xcoin_deduct', 'badge_deduct'),
        ('xcoin_add', 'badge_add'),
    ],
    f'{BASE}/admin/settings/page.tsx': COMMON_RENAMES + [
        # Rank display: old field names -> new
        ('r.requirement.toLocaleString()} XP', 'r.xcoinUnlock.toLocaleString()} XC'),
        ('XP Required:', 'XC Unlock:'),
        ('Coins (Total):', 'Maintain XC:'),
        ('{r.requirementXcoin || 0}', '{r.xcoinMaintain.toLocaleString()}'),
        ('{r.specificCoinRequirement && (', '{r.specificBadgeRequirements && r.specificBadgeRequirements.length > 0 && ('),
        ('Specific Badge: <b', 'Required Badges: <b'),
        ('{r.specificCoinRequirement}', '{r.specificBadgeRequirements?.join(", ")}'),
        # Edit form: old fields -> new
        ('editingRank.requirement', 'editingRank.xcoinUnlock'),
        ('...editingRank, requirement:', '...editingRank, xcoinUnlock:'),
        ('editingRank.requirementXcoin || 0', 'editingRank.xcoinMaintain || 0'),
        ('...editingRank, requirementXcoin:', '...editingRank, xcoinMaintain:'),
        ('editingRank.specificCoinRequirement || ""', '(editingRank.specificBadgeRequirements || []).join(", ")'),
        ('...editingRank, specificCoinRequirement:', '...editingRank, specificBadgeRequirements:'),
    ],
    f'{BASE}/components/SideNav.tsx': COMMON_RENAMES + [
        # Stats display labels
        ('>{user.digitalBadges}<', '>{user.digitalBadges}<'),  # no-op
        ('>{user.xcoin}<', '>{user.xcoin}<'),  # no-op
    ],
    f'{BASE}/components/PlayerAssistant.tsx': COMMON_RENAMES + [
        # import
        ('getLevelFromXP, getXPProgress, getCurrentRank, getRankProgress,',
         'getLevelFromXC, getXCProgress, getCurrentRank, getRankProgress,'),
        # Display text in template strings
        ('XP and ${player.digitalBadges} badges', 'XC and ${player.digitalBadges} Digital Badges'),
        ('${player.xcoin.toLocaleString()} XP (Level', '${player.xcoin.toLocaleString()} XC (Level'),
        ('XP · Level', 'XC · Level'),
        ('⚡ XP:', '⚡ XC:'),
        ('XP${', 'XC${'),
        ('${t.xcReward} XP', '${t.xcReward} XC'),
        ('${j.xcReward} XP', '${j.xcReward} XC'),
        ('${u.xcoin.toLocaleString()} XP', '${u.xcoin.toLocaleString()} XC'),
        ('player.xcoin.toLocaleString()} XP', 'player.xcoin.toLocaleString()} XC'),
        ('${player.xcoin.toLocaleString()} XP', '${player.xcoin.toLocaleString()} XC'),
        ('⚡ ${player.xcoin.toLocaleString()}', '⚡ ${player.xcoin.toLocaleString()}'),
        ('🪙 ${player.digitalBadges} badges', '🪙 ${player.digitalBadges} Digital Badges'),
        # Progress bar - already handled by getXCProgress rename
    ],
    f'{BASE}/components/AIAssistant.tsx': COMMON_RENAMES + [
        # X-Coin badge labels in strings
        ('XP · ${players.reduce((s,u)=>s+u.digitalBadges,0)} Digital Badge badges',
         'XC · ${players.reduce((s,u)=>s+u.digitalBadges,0)} Digital Badges'),
        # economy summary
        ('X-Coin badges across', 'Digital Badges across'),
        ('${players.reduce((s,u)=>s+u.xcoin,0).toLocaleString()} XC',
         '${players.reduce((s,u)=>s+u.xcoin,0).toLocaleString()} XC'),
    ],
    f'{BASE}/profile/[id]/page.tsx': COMMON_RENAMES + [
        # import
        ('getCurrentRank, getRankProgress, getXPProgress',
         'getCurrentRank, getRankProgress, getXCProgress'),
        # xpProgress variable
        ('const xpProgress = getXCProgress(', 'const xpProgress = getXCProgress('),  # no-op
        # display
        ('{profileUser.digitalBadges}', '{profileUser.digitalBadges}'),  # no-op
        ('{profileUser.totalXcoin.toLocaleString()}', '{profileUser.totalXcoin.toLocaleString()}'),  # no-op
    ],
    f'{BASE}/player/tasks/page.tsx': COMMON_RENAMES,
    f'{BASE}/player/task-management/page.tsx': COMMON_RENAMES + [
        ('{t.xcReward} XP', '{t.xcReward} XC'),
        ('{j.xcReward} XP', '{j.xcReward} XC'),
    ],
    f'{BASE}/player/marketplace/page.tsx': COMMON_RENAMES + [
        # Purchase check: user.xcoin (XC spending) >= costXcoin (already renamed)
        # Badge (old xcoin) check:
        # After COMMON: user.xcoin = spending XC, user.digitalBadges = badge count
        # Fix: the second check was user.xcoin < mod.costXcoin which was badge check
        # In new system: modifier costs are in XC (costXcoin) and badge (costBadge)
        # Old: if (user.xp < mod.costXp || user.xcoin < mod.costXcoin)
        # After common: user.xcoin < mod.costXcoin || user.digitalBadges < mod.costXcoin
        # We need: user.xcoin < mod.costXcoin || user.digitalBadges < mod.costBadge
        ('user.digitalBadges < mod.costXcoin', 'user.digitalBadges < mod.costBadge'),
        # Fix second occurrence
        ('user.xcoin < mod.costXcoin', 'user.xcoin < mod.costXcoin'),  # no-op (first part)
        # Display labels
        ('>⚡ {user.xcoin}</div>', '>⚡ {user.xcoin} XC</div>'),
        ('🪙 {user.digitalBadges}', '🏅 {user.digitalBadges}'),
        # cost display
        ('{mod.costXcoin} XP', '{mod.costXcoin} XC'),
        ('>⚡ {mod.costXcoin} XC<', '>⚡ {mod.costXcoin} XC<'),
    ],
    f'{BASE}/player/leaderboard/page.tsx': COMMON_RENAMES + [
        # Sort key: "xp" -> "xcoin" (as string value)
        ('"xp"', '"xcoin"'),
        # import
        ('import { User, mockUsers, getXPProgress, getCurrentRank, getMockCohorts }',
         'import { User, mockUsers, getXCProgress, getCurrentRank, getMockCohorts }'),
        # Display
        ('TOTAL XC', 'TOTAL XC'),  # no-op
        ('🪙 ${user.digitalBadges} BADGES', '🏅 ${user.digitalBadges} BADGES'),
        ('🪙 {s.digitalBadges}', '🏅 {s.digitalBadges}'),
        # progress bar: getXCProgress -> already renamed
    ],
    f'{BASE}/player/wallet/page.tsx': COMMON_RENAMES + [
        # Display labels
        ('{user.digitalBadges}', '{user.digitalBadges}'),  # no-op
        ('{user.xcoin.toLocaleString()}', '{user.xcoin.toLocaleString()}'),  # no-op
        ('Value: {coin.xc} XP', 'Value: {coin.xc} XC'),
    ],
    f'{BASE}/player/page.tsx': COMMON_RENAMES + [
        # Local interface - xpReward already renamed to xcReward by COMMON
        # Local tasks array
        ('xcoinReward', 'xcReward'),  # already correct but make consistent
        # Display
        ('Math.floor(user.totalXcoin % 1000)} / 1000 XP', 'Math.floor(user.totalXcoin % 1000)} / 1000 XC'),
        ('{user.totalXcoin} total XP earned', '{user.totalXcoin.toLocaleString()} total XC earned'),
        ('+{task.xcReward} XP', '+{task.xcReward} XC'),
        ('+{task.xcReward} XC •', '+{task.xcReward} XC •'),  # no-op
        ('+{task.xcReward} XC • +{task.xcReward}', '+{task.xcReward} XC • +{task.xcReward}'),  # no-op
    ],
}

print('=== Updating all pages ===\n')
updated = 0
for filepath, replacements in FILES.items():
    result = patch(filepath, replacements)
    if result:
        updated += 1

print(f'\nDone. Updated {updated}/{len(FILES)} files.')
