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
        if hasattr(old, 'sub'):
            content = old.sub(new, content)
        else:
            content = content.replace(old, new)
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'  Fixed: {filepath}')
        return True
    else:
        print(f'  No change: {filepath}')
        return False

# ── Fix: ".xc" -> ".xcoin" EXCEPT "coin.xc" (the Coin field) ──
# Use negative lookbehind: (?<!coin)\.xc\b
FIX_XC_TO_XCOIN = re.compile(r'(?<!coin)\.xc\b')
# Also fix "xc" -> "xcoin" in sort-key string literals like sortBy === "xc"
FIX_XC_STR = re.compile(r'"xc"')

# Settings page specific fixes
SETTINGS_FIXES = [
    # Fix r.requirement -> r.xcoinUnlock (the XC Required display)
    ('r.requirement.toLocaleString()} XC', 'r.xcoinUnlock.toLocaleString()} XC'),
    # Fix editingRank.xcoinUnlockXcoin -> editingRank.xcoinMaintain
    ('editingRank.xcoinUnlockXcoin', 'editingRank.xcoinMaintain'),
    # Fix: checkpointsRequired display (add it to settings view)
    ('{r.xcoinMaintain.toLocaleString()}', '{r.xcoinMaintain.toLocaleString()}'),  # no-op verify
]

# Leaderboard sort key fixes: "xc" -> "digitalBadge" in sort type context
LEADERBOARD_FIXES = [
    ('sortBy === "xc"', 'sortBy === "digitalBadge"'),
    ('s === "xc"', 's === "digitalBadge"'),
    ('"xcoin" | "xc"', '"xcoin" | "digitalBadge"'),
    ('["xcoin", "xc"]', '["xcoin", "digitalBadge"]'),
    ('("xcoin")', '("xcoin")'),  # no-op
    # Button label: fix "xc" in text if needed
    ('Digital Badge Ranking"', 'Digital Badge Ranking"'),  # no-op
]

FILES = [
    f'{BASE}/admin/players/page.tsx',
    f'{BASE}/admin/coins/page.tsx',
    f'{BASE}/admin/leaderboard/page.tsx',
    f'{BASE}/admin/approvals/page.tsx',
    f'{BASE}/admin/page.tsx',
    f'{BASE}/admin/modifiers/page.tsx',
    f'{BASE}/admin/tasks/page.tsx',
    f'{BASE}/admin/jobs/page.tsx',
    f'{BASE}/components/SideNav.tsx',
    f'{BASE}/components/PlayerAssistant.tsx',
    f'{BASE}/components/AIAssistant.tsx',
    f'{BASE}/profile/[id]/page.tsx',
    f'{BASE}/player/tasks/page.tsx',
    f'{BASE}/player/task-management/page.tsx',
    f'{BASE}/player/marketplace/page.tsx',
    f'{BASE}/player/leaderboard/page.tsx',
    f'{BASE}/player/wallet/page.tsx',
    f'{BASE}/player/page.tsx',
    f'{BASE}/player/jobs/page.tsx',
]

print('=== Fixing .xc -> .xcoin (non-coin) across all files ===\n')

for filepath in FILES:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        continue
    original = content

    # Fix ?.xc / .xc that are NOT preceded by "coin"
    content = FIX_XC_TO_XCOIN.sub('.xcoin', content)

    # Apply file-specific fixes
    if 'settings/page.tsx' in filepath:
        for old, new in SETTINGS_FIXES:
            content = content.replace(old, new)

    if 'leaderboard/page.tsx' in filepath:
        for old, new in LEADERBOARD_FIXES:
            content = content.replace(old, new)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'  Fixed: {filepath}')
    else:
        print(f'  No change: {filepath}')

# Now fix the leaderboard button text (sort labels)
print('\n=== Fixing leaderboard sort button labels ===')
for lb_file in [
    f'{BASE}/admin/leaderboard/page.tsx',
    f'{BASE}/player/leaderboard/page.tsx',
]:
    try:
        with open(lb_file, 'r') as f:
            content = f.read()
        original = content
        # "xp Ranking" or "⚡ XP Ranking" -> keep as XC Ranking
        content = content.replace('? "⚡ XP Ranking" : "🪙 Digital Badge Ranking"',
                                   '? "⚡ XC Ranking" : "🏅 Digital Badge Ranking"')
        content = content.replace("? '⚡ XP Ranking' : '🪙 Digital Badge Ranking'",
                                   "? '⚡ XC Ranking' : '🏅 Digital Badge Ranking'")
        # Fix badge sort display text
        content = content.replace('🪙 {user.totalXcoin.toLocaleString()} TOTAL XC',
                                   '⚡ {user.totalXcoin.toLocaleString()} TOTAL XC')
        if content != original:
            with open(lb_file, 'w') as f:
                f.write(content)
            print(f'  Fixed: {lb_file}')
        else:
            print(f'  No change: {lb_file}')
    except FileNotFoundError:
        pass

print('\n=== Verifying key field accesses ===')
import subprocess
result = subprocess.run(
    ['grep', '-rn', r'\.xc\b', '--include=*.tsx', '--include=*.ts',
     f'{BASE}'],
    capture_output=True, text=True
)
lines = [l for l in result.stdout.split('\n') if l and
         'data.ts' not in l and 'update_' not in l and 'fix_xc' not in l]
# Only show lines where .xc is NOT preceded by "coin"
real_issues = [l for l in lines if not re.search(r'coin\.xc', l)]
if real_issues:
    print('Remaining .xc issues:')
    for l in real_issues[:15]:
        print(' ', l)
else:
    print('  No remaining .xc issues (all are correct coin.xc references)')

print('\nDone!')
