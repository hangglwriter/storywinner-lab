"""
스토리위너 기획실 - 사이드바/홈/네비 자동 생성기
각 섹션 폴더의 .md를 스캔해 frontmatter(title/sidebar/date)로 _sidebar.md, home.md, _navbar.md 생성.
행글라이터 기획실(youtube-reports) 패턴을 새 폴더 분류에 맞게 단순화.

사용법: python update_sidebar.py   (또는 publish.bat이 자동 호출)
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent

# 섹션 정의 (사이드바 표시 순서). folder=루트 기준 상대경로, readme=섹션 헤더가 링크할 인덱스
SECTIONS = [
    {"emoji": "📡", "title": "트렌드 레이더", "folder": "radar"},
    {"emoji": "🕷", "title": "크롤 스냅샷", "folder": "crawl"},
    {"emoji": "🔍", "title": "벤치마킹", "folder": "bench"},
    {"emoji": "💼", "title": "창업 사례", "folder": "cases"},
    {"emoji": "📋", "title": "발행 파이프라인", "folder": "pipeline"},
    {"emoji": "🗂", "title": "인벤토리", "folder": "inventory"},
    {"emoji": "📨", "title": "뉴스레터", "folder": "newsletter"},
]


def parse_frontmatter(fp):
    try:
        text = fp.read_text(encoding="utf-8-sig")
    except Exception:
        return {}
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}
    fm = {}
    for line in m.group(1).strip().split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip().strip('"').strip("'")
    return fm


def first_heading(fp):
    try:
        infm = False
        for line in fp.read_text(encoding="utf-8-sig").splitlines():
            s = line.strip()
            if s == "---":
                infm = not infm
                continue
            if infm:
                continue
            if s.startswith("# "):
                return s[2:].strip()
    except Exception:
        pass
    return None


def date_of(fm, fp):
    if fm.get("date"):
        return fm["date"]
    m = re.match(r"(\d{4}-\d{2}-\d{2})", fp.name)
    return m.group(1) if m else "0000-00-00"


def label_of(fm, fp):
    lbl = fm.get("sidebar") or fm.get("title")
    if not lbl:
        lbl = first_heading(fp) or re.sub(r"^\d{4}-\d{2}-\d{2}-", "", fp.stem)
    if len(lbl) > 48:
        lbl = lbl[:48] + "..."
    return lbl


def scan(folder):
    """폴더(하위 포함) .md 스캔 -> [{label, rel, date, sub}] 최신순. README/_파일/inbox 제외."""
    base = ROOT / folder
    items = []
    if not base.exists():
        return items
    for fp in base.rglob("*.md"):
        if fp.name.startswith("_") or fp.name.lower() == "readme.md" or fp.name == "inbox.md":
            continue
        fm = parse_frontmatter(fp)
        rel = fp.relative_to(ROOT).as_posix()
        sub = fp.parent.relative_to(base).as_posix()  # "." or subfolder name
        items.append({
            "label": label_of(fm, fp),
            "rel": rel,
            "date": date_of(fm, fp),
            "sub": "" if sub == "." else sub,
        })
    items.sort(key=lambda x: (x["date"], x["label"]), reverse=True)
    return items


def section_header(sec, prefix=""):
    folder = sec["folder"]
    idx = ROOT / folder / "README.md"
    title = f"{sec['emoji']} **{sec['title']}**"
    if idx.exists():
        return f"* [{title}]({prefix}{folder}/)"
    return f"* {title}"


def render_section(sec, items, prefix="", limit=None):
    lines = [section_header(sec, prefix)]
    shown = items if limit is None else items[:limit]
    # 하위폴더가 있으면 sub 라벨을 앞에 작게 붙임
    for it in shown:
        tag = f"`{it['sub']}` " if it["sub"] else ""
        lines.append(f"  * [{tag}{it['label']}]({prefix}{it['rel']})")
    if not shown:
        lines.append("  * _(아직 없음)_")
    if limit and len(items) > limit:
        lines.append(f"  * [⋯ 전체 {len(items)}건]({prefix}{sec['folder']}/)")
    return lines


def scan_notes():
    nd = ROOT / "notes"
    items = []
    if (nd / "inbox.md").exists():
        items.append({"label": "📥 인박스 (사이트에서 편집)", "rel": "notes/inbox.md", "date": "9999"})
    if nd.exists():
        for fp in sorted(nd.glob("*.md"), reverse=True):
            if fp.name in ("inbox.md",) or fp.name.startswith("_") or fp.name.lower() == "readme.md":
                continue
            m = re.match(r"(\d{4}-\d{2}-\d{2})", fp.name)
            items.append({"label": m.group(1) if m else fp.stem, "rel": f"notes/{fp.name}", "date": fp.stem})
    return items


def build_sidebar(per_section, notes, prefix=""):
    lines = []
    # 메모 최상단
    lines.append(f"* [📝 **메모**]({prefix}notes/inbox.md)")
    for n in notes[:8]:
        lines.append(f"  * [{n['label']}]({prefix}{n['rel']})")
    lines.append("")
    for sec in SECTIONS:
        lines += render_section(sec, per_section[sec["folder"]], prefix)
        lines.append("")
    # 외부 링크
    lines.append("* **🔗 연결**")
    lines.append("  * [🎬 행글라이터 기획실](https://youtube-reports.vercel.app)")
    lines.append("  * [🌐 스토리위너 홈피](https://storywinner.co.kr)")
    return "\n".join(lines) + "\n"


def build_navbar():
    lines = [
        "* [전체](/)",
        "* [📡 레이더](/radar/)",
        "* [📋 파이프라인](/pipeline/)",
        "* [🔍 벤치](/bench/)",
        "* [🎬 행글 기획실](https://youtube-reports.vercel.app)",
    ]
    return "\n".join(lines) + "\n"


def build_home(per_section, notes):
    lines = [
        "# 📚 스토리위너 기획실",
        "",
        "책쓰기 · 콘텐츠마케팅 · AI글쓰기 발행을 위한 **인텔리전스 허브**.",
        "조사(레이더·크롤·벤치) → 분배 → 콘텐츠·뉴스레터 출고.",
        "",
    ]
    if notes[1:]:
        lines += ["## 📝 최근 메모", ""]
        for n in notes[1:4]:
            lines.append(f"- [{n['label']}]({n['rel']})")
        lines.append("")
    # 섹션별 최신 몇 건
    pairs = [("radar", "📡 트렌드 레이더", 3), ("pipeline", "📋 발행 대기", 5),
             ("crawl", "🕷 최근 크롤", 3), ("bench", "🔍 벤치마킹", 4),
             ("inventory", "🗂 인벤토리(모아둔 소스)", 5)]
    for folder, title, n in pairs:
        items = per_section.get(folder, [])
        if not items:
            continue
        lines += [f"## {title}", ""]
        for it in items[:n]:
            tag = f"`{it['sub']}` " if it["sub"] else ""
            lines.append(f"- [{tag}{it['label']}]({it['rel']})")
        if len(items) > n:
            lines.append(f"- [⋯ 전체 {len(items)}건]({folder}/)")
        lines.append("")
    lines += [
        "## 사용법",
        "",
        "- **상단 검색**으로 전체(브런치·유튜브·키워드·벤치) 풀텍스트 검색",
        "- **왼쪽 사이드바**에서 섹션별 탐색",
        "- **우하단 📝 버튼**으로 사이트에서 바로 메모 → `notes/inbox.md` 자동 저장",
        "- 조사 문서 맨 아래 **`→ 분배`** 로 영상/콘텐츠/뉴스레터/사업아이디어 라우팅",
        "",
    ]
    return "\n".join(lines) + "\n"


def write_if_changed(path, content):
    try:
        if path.exists() and path.read_text(encoding="utf-8") == content:
            return False
    except Exception:
        pass
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


if __name__ == "__main__":
    per_section = {sec["folder"]: scan(sec["folder"]) for sec in SECTIONS}
    notes = scan_notes()

    write_if_changed(ROOT / "_sidebar.md", build_sidebar(per_section, notes))
    write_if_changed(ROOT / "_navbar.md", build_navbar())
    write_if_changed(ROOT / "home.md", build_home(per_section, notes))
    def safe_print(s):
        try:
            print(s)
        except UnicodeEncodeError:
            print(s.encode("ascii", "replace").decode())
    safe_print("생성 완료: _sidebar.md, _navbar.md, home.md")
    for sec in SECTIONS:
        safe_print(f"  {sec['emoji']} {sec['title']}: {len(per_section[sec['folder']])}건")
