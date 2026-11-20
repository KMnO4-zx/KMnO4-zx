#!/usr/bin/env python3
"""Sync GitHub achievement badges from the live profile into the homepage.

What it does
  1. Fetches https://github.com/KMnO4-zx and parses the unlocked achievement
     badges (slug, display name, tier, image URL).
  2. Downloads badge PNGs into image/achievements/<slug>.png.
  3. Regenerates the marked achievements block in index.html and the marked
     ach.* tooltip entries (en + zh) in main.js. Bumps main.js?v=N when the
     tooltips change so browsers pick them up.

Behavior
  - Idempotent: files are only written when their content actually changes.
  - Safe: aborts without writing anything if the profile cannot be fetched or
    parsed, or if a previously synced achievement disappears (achievements are
    permanent on GitHub, so a shrink means the markup changed, not a loss).

Usage
  python3 scripts/sync-achievements.py               # live sync
  python3 scripts/sync-achievements.py --dry-run     # report, change nothing
  python3 scripts/sync-achievements.py --html-file f # parse a saved profile
"""

import argparse
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "image" / "achievements"
INDEX = ROOT / "index.html"
MAIN_JS = ROOT / "main.js"

PROFILE_URL = "https://github.com/KMnO4-zx"
ACHIEVEMENTS_URL = "https://github.com/KMnO4-zx?tab=achievements"
UA = {"User-Agent": "Mozilla/5.0 (compatible; achievements-sync)"}

HTML_START = "<!-- achievements:start (auto-synced by scripts/sync-achievements.py — do not edit by hand) -->"
HTML_END = "<!-- achievements:end -->"
JS_START = "// achievements:i18n:start (auto-synced by scripts/sync-achievements.py)"
JS_END = "// achievements:i18n:end"

# Tooltip descriptions per achievement slug. `tiers` maps tier number -> the
# threshold it represents, used to fill {stars}/{prs} in the description.
# Unknown slugs fall back to a name-only tooltip.
DESCRIPTIONS = {
    "yolo": {
        "en": "merged a pull request without review",
        "zh": "未经 review 直接合并了 PR",
    },
    "starstruck": {
        "en": "created a repository with {stars}+ stars",
        "zh": "创建的仓库获得 {stars}+ stars",
        "tiers": {1: 16, 2: 128, 3: 512, 4: 4096},
    },
    "quickdraw": {
        "en": "closed an issue or PR within 5 minutes of opening",
        "zh": "在 issue/PR 打开后 5 分钟内将其关闭",
    },
    "pair-extraordinaire": {
        "en": "coauthored commits on merged pull requests",
        "zh": "在被合并的 PR 中共同署名提交",
    },
    "pull-shark": {
        "en": "{prs} pull requests merged",
        "zh": "已有 {prs} 个 PR 被合并",
        "tiers": {1: 2, 2: 16, 3: 128, 4: 1024},
    },
    "galaxy-brain": {
        "en": "answered a discussion",
        "zh": "回答了 Discussion",
    },
    "arctic-code-vault-contributor": {
        "en": "contributed code to the Arctic Code Vault",
        "zh": "为北极代码库贡献了代码",
    },
    "public-sponsor": {
        "en": "sponsored an open source contributor",
        "zh": "赞助了开源贡献者",
    },
}

TIER_CLASS = {"bronze": "tier-bronze", "silver": "tier-silver", "gold": "tier-gold"}

BLOCK_RE = re.compile(
    r'<a\s+href="/KMnO4-zx\?achievement=([a-z0-9-]+)&amp;tab=achievements"[^>]*>(.*?)</a>',
    re.S,
)
TIER_RE = re.compile(r"achievement-tier-label[^>]*>\s*x(\d+)\s*<")
MATERIAL_RE = re.compile(r"-(default|bronze|silver|gold)-[0-9a-f]+\.png$")


def fetch(url, timeout=30, retries=3):
    last = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except Exception as e:  # noqa: BLE001 — retry any network/HTTP error
            last = e
    raise SystemExit(f"error: failed to fetch {url}: {last}")


def parse_badges(page_html):
    """Return [{slug, name, tier, material, src}] in profile order, deduped."""
    badges, seen = [], set()
    for m in BLOCK_RE.finditer(page_html):
        slug, block = m.group(1), m.group(2)
        if slug in seen:
            continue
        src = re.search(r'\bsrc="([^"]+)"', block)
        alt = re.search(r'\balt="Achievement: ([^"]+)"', block)
        if not src or not alt:
            continue
        src = html.unescape(src.group(1))
        if not src.startswith("https://github.githubassets.com/"):
            continue
        tier_m = TIER_RE.search(block)
        mat_m = MATERIAL_RE.search(src)
        badges.append({
            "slug": slug,
            "name": html.unescape(alt.group(1)),
            "tier": int(tier_m.group(1)) if tier_m else 1,
            "material": mat_m.group(1) if mat_m else "default",
            "src": src,
        })
        seen.add(slug)
    return badges


def tooltip(badge, lang):
    label = badge["name"] + (f" x{badge['tier']}" if badge["tier"] > 1 else "")
    desc = DESCRIPTIONS.get(badge["slug"])
    if not desc:
        return label
    text = desc[lang]
    thresholds = desc.get("tiers", {})
    if badge["tier"] in thresholds:
        n = f"{thresholds[badge['tier']]:,}"
        text = text.format(stars=n, prs=n)
    return f"{label} — {text}"


def render_html(badges):
    lines = ['        <ul class="achievements" aria-label="GitHub achievements">']
    for b in badges:
        title = html.escape(tooltip(b, "en"), quote=True)
        alt = html.escape(b["name"] + (f" x{b['tier']}" if b["tier"] > 1 else ""), quote=True)
        lines.append("          <li>")
        lines.append(
            f'            <a class="achievement" href="{ACHIEVEMENTS_URL}" '
            f'target="_blank" rel="noopener" title="{title}" data-i18n-title="ach.{b["slug"]}">'
        )
        lines.append(
            f'              <img src="image/achievements/{b["slug"]}.png" '
            f'alt="{alt}" width="52" height="52">'
        )
        if b["tier"] > 1:
            cls = TIER_CLASS.get(b["material"], "tier-gold")
            lines.append(
                f'              <span class="ach-tier {cls} mono" aria-hidden="true">x{b["tier"]}</span>'
            )
        lines.append("            </a>")
        lines.append("          </li>")
    lines.append("        </ul>")
    return "\n".join(lines)


def render_js_entries(badges, lang):
    return "\n".join(
        f'      "ach.{b["slug"]}": {json.dumps(tooltip(b, lang), ensure_ascii=False)},'
        for b in badges
    )


def replace_regions(text, start, end, payloads):
    """Replace each start..end region (inclusive) with start + payload + end.

    One payload per region, in document order; aborts if the count differs.
    """
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    matches = list(pattern.finditer(text))
    if len(matches) != len(payloads):
        raise SystemExit(
            f"error: expected {len(payloads)} marked region(s) starting {start[:40]!r}, "
            f"found {len(matches)}"
        )
    out, last = [], 0
    for m, payload in zip(matches, payloads):
        indent = re.search(r"[ \t]*$", text[: m.start()]).group(0)
        out.append(text[last : m.start()])
        out.append(start + "\n" + payload + "\n" + indent + end)
        last = m.end()
    out.append(text[last:])
    return "".join(out)


def write_if_changed(path, content, dry_run):
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old == content:
        return False
    if not dry_run:
        path.write_text(content, encoding="utf-8")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="report changes without writing")
    ap.add_argument("--html-file", help="parse a saved profile page instead of fetching")
    args = ap.parse_args()

    page = (
        Path(args.html_file).read_text(encoding="utf-8")
        if args.html_file
        else fetch(PROFILE_URL).decode("utf-8")
    )
    badges = parse_badges(page)
    if not badges:
        raise SystemExit("error: no achievement badges parsed — GitHub markup may have changed; aborting")

    index_src = INDEX.read_text(encoding="utf-8")
    js_src = MAIN_JS.read_text(encoding="utf-8")

    # Safety: achievements are permanent — never drop one we already show.
    current_slugs = set(re.findall(r"image/achievements/([a-z0-9-]+)\.png", index_src))
    new_slugs = {b["slug"] for b in badges}
    missing = current_slugs - new_slugs
    if missing:
        raise SystemExit(f"error: achievements disappeared from profile ({sorted(missing)}); aborting")

    changed = []

    new_index = replace_regions(index_src, HTML_START, HTML_END, [render_html(badges)])
    new_js = replace_regions(
        js_src, JS_START, JS_END,
        [render_js_entries(badges, "en"), render_js_entries(badges, "zh")],
    )

    # Bump the main.js cache version when tooltips changed.
    if new_js != js_src:
        vm = re.search(r"main\.js\?v=(\d+)", new_index)
        if vm:
            new_index = new_index.replace(vm.group(0), f"main.js?v={int(vm.group(1)) + 1}", 1)

    if write_if_changed(INDEX, new_index, args.dry_run):
        changed.append("index.html")
    if write_if_changed(MAIN_JS, new_js, args.dry_run):
        changed.append("main.js")

    # Badge images: download only when missing or different; drop stale ones.
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for b in badges:
        dest = IMG_DIR / f"{b['slug']}.png"
        if args.dry_run:
            if not dest.exists():
                changed.append(f"image/achievements/{b['slug']}.png (new)")
            continue
        data = fetch(b["src"])
        if not dest.exists() or dest.read_bytes() != data:
            dest.write_bytes(data)
            changed.append(f"image/achievements/{b['slug']}.png")
    for old in IMG_DIR.glob("*.png"):
        if old.stem not in new_slugs:
            if not args.dry_run:
                old.unlink()
            changed.append(f"{old.relative_to(ROOT)} (removed)")

    summary = ", ".join(f"{b['slug']} x{b['tier']}" if b["tier"] > 1 else b["slug"] for b in badges)
    if changed:
        print(("would change: " if args.dry_run else "updated: ") + ", ".join(changed))
    else:
        print("achievements already in sync — no changes")
    print(f"profile badges: {summary}")


if __name__ == "__main__":
    main()