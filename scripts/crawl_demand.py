"""
수요 신호 크롤 — 크몽 전자책 + 브런치 글쓰기/출판 인기글
결과: storywinner-lab/crawl/YYYY-MM-DD-수요신호.md
실행: python -u scripts/crawl_demand.py
"""
import sys, time, re
sys.stdout.reconfigure(encoding="utf-8")
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

OUT = "D:/Sites/storywinner-lab/crawl/2026-06-18-수요신호.md"


def driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-dev-shm-usage")
    o.add_argument("--disable-blink-features=AutomationControlled")
    o.add_argument("--window-size=1400,1900")
    o.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
    o.page_load_strategy = "eager"
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(40)
    return d


def kmong(d):
    """크몽 전자책 검색 상위 gig (제목+가격)"""
    out = []
    url = "https://kmong.com/search?keyword=%EC%A0%84%EC%9E%90%ECB1%85&type=gigs"
    # 안전한 인코딩으로 재구성
    from urllib.parse import quote
    url = f"https://kmong.com/search?keyword={quote('전자책')}&type=gigs"
    d.get(url)
    time.sleep(4)
    for _ in range(4):
        d.execute_script("window.scrollTo(0, document.body.scrollHeight*0.8);")
        time.sleep(1.2)
    cards = d.find_elements(By.CSS_SELECTOR, "a[href*='/gig/']")
    seen = set()
    for c in cards:
        href = c.get_attribute("href") or ""
        m = re.search(r"/gig/(\d+)", href)
        if not m or m.group(1) in seen:
            continue
        txt = (c.text or "").strip().replace("\n", " | ")
        if len(txt) < 6:
            continue
        seen.add(m.group(1))
        out.append((m.group(1), txt[:160]))
        if len(out) >= 25:
            break
    return out


def brunch(d, q):
    out = []
    from urllib.parse import quote
    d.get(f"https://brunch.co.kr/search?q={quote(q)}")
    time.sleep(3.5)
    for _ in range(3):
        d.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1.2)
    links = d.find_elements(By.CSS_SELECTOR, "a[href*='/@']")
    seen = set()
    for a in links:
        href = a.get_attribute("href") or ""
        m = re.search(r"/@[\w]+/(\d+)", href)
        if not m:
            continue
        t = (a.text or "").strip().split("\n")[0]
        if not t or len(t) < 6 or href in seen:
            continue
        seen.add(href)
        out.append((t[:120], href))
        if len(out) >= 20:
            break
    return out


def main():
    d = driver()
    try:
        print("크몽 전자책 검색...", flush=True)
        try:
            km = kmong(d)
        except Exception as e:
            km = []
            print("크몽 실패:", e, flush=True)
        print(f"  크몽 {len(km)}건", flush=True)

        print("브런치 전자책 출판 검색...", flush=True)
        try:
            br = brunch(d, "전자책 출판")
        except Exception as e:
            br = []
            print("브런치 실패:", e, flush=True)
        print(f"  브런치 {len(br)}건", flush=True)

        L = [
            "---",
            'title: "수요 신호 크롤 — 크몽 전자책 + 브런치 인기글 (2026-06-18)"',
            "date: 2026-06-18",
            "---",
            "",
            "# 수요 신호 크롤 (2026-06-18)",
            "",
            "> 자동 수집. 무엇이 팔리고 읽히는지의 신호. 다음 레이더에 반영.",
            "",
            f"## 크몽 '전자책' 상위 gig ({len(km)}건)",
            "",
        ]
        if km:
            for gid, txt in km:
                L.append(f"- [{txt}](https://kmong.com/gig/{gid})")
        else:
            L.append("- _(수집 실패 — 셀렉터 점검 필요)_")
        L += ["", f"## 브런치 '전자책 출판' 글 ({len(br)}건)", ""]
        if br:
            for t, href in br:
                L.append(f"- [{t}]({href})")
        else:
            L.append("- _(수집 실패 — 셀렉터 점검 필요)_")
        L += [
            "",
            "## → 분배",
            "- 📝 블로그감: 크몽 상위 주제 중 홈피에 없는 것 → pipeline/책",
            "- 📡 레이더: 반복 등장 주제를 다음 호 트렌드에 반영",
            "",
        ]
        open(OUT, "w", encoding="utf-8").write("\n".join(L))
        print("저장:", OUT, flush=True)
    finally:
        d.quit()


if __name__ == "__main__":
    main()
