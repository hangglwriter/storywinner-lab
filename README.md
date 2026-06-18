# 스토리위너 기획실 (storywinner-lab)

책쓰기 · 콘텐츠마케팅 · AI글쓰기 발행을 위한 **인텔리전스 허브** (Docsify + Vercel).
행글라이터 기획실(youtube-reports) 패턴 복제 + 콘텐츠 발행 파이프라인용으로 확장.

## 구조
- `radar/` 📡 트렌드 레이더 (월간, → 분배로 출구 라우팅)
- `crawl/` 🕷 주요 사이트 크롤 스냅샷 (수요 신호)
- `bench/` 🔍 벤치마킹 (국내·해외 인물/브랜드)
- `cases/` 💼 창업·사업 사례 (사업아이디어 발생 → 행글 ideas/ 승격)
- `pipeline/` 📋 발행 파이프라인 (강의후기·AI·책)
- `inventory/` 🗂 모아둔 소스 (브런치·유튜브·키워드)
- `newsletter/` 📨 뉴스레터
- `notes/inbox.md` 📥 사이트에서 직접 메모 (GitHub API)

## 갱신
```
python update_sidebar.py     # _sidebar/home/_navbar 자동 생성
```
새 .md 추가 → 위 명령 → commit & push → Vercel 자동 배포.
⚠️ 루트 README.md는 Vercel build에서 제외되므로 사이트 메인은 `home.md`.

## 연계
- 입구: 행글라이터 기획실 `research/`·`ideas/` (브레인)
- 출구: 이 사이트 `pipeline`/`newsletter` (공장) + 행글 유튜브
- 사업아이디어는 행글 `ideas/`로 단일화
