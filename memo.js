/**
 * 스토리위너 기획실 - 메모 위젯 (Inbox 방식)
 *
 * notes/inbox.md 한 파일에 모든 메모 누적.
 * 패널 열면 전체 내용 로드 → 자유 편집 → 저장으로 덮어쓰기.
 */

(function () {
  const REPO = "hangglwriter/storywinner-lab";
  const TOKEN_KEY = "gh_token_storywinner_lab";
  const BRANCH = "main";
  const INBOX_PATH = "notes/inbox.md";

  // ── 스타일 주입 ──────────────────────────────────────────────
  const css = `
    #memo-fab {
      position: fixed; right: 24px; bottom: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: #4a90d9; color: #fff; border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-size: 22px; cursor: pointer; z-index: 9998;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s ease;
    }
    #memo-fab:hover { transform: scale(1.08); }
    #memo-panel {
      position: fixed; right: 24px; bottom: 92px;
      width: 480px; max-width: calc(100vw - 48px);
      height: 640px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 9999; display: none;
      flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #memo-panel.open { display: flex; }
    #memo-header {
      padding: 12px 16px; background: #4a90d9; color: #fff;
      display: flex; justify-content: space-between; align-items: center;
    }
    #memo-header strong { font-size: 15px; }
    #memo-header-actions { display: flex; gap: 6px; align-items: center; }
    #memo-header-actions button {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      padding: 4px 10px; border-radius: 4px; cursor: pointer;
      font-size: 12px;
    }
    #memo-header-actions button:hover { background: rgba(255,255,255,0.3); }
    #memo-close {
      background: transparent !important; padding: 0 !important;
      font-size: 22px !important; line-height: 1 !important;
    }
    #memo-context {
      font-size: 11px; color: #666; padding: 6px 16px;
      background: #f4f6f9; border-bottom: 1px solid #e5e8ec;
      word-break: break-all;
    }
    #memo-text {
      flex: 1; width: 100%; padding: 14px 16px; border: none;
      font-size: 14px; resize: none; box-sizing: border-box;
      font-family: ui-monospace, "SF Mono", Consolas, monospace;
      line-height: 1.6; outline: none;
    }
    #memo-status {
      padding: 6px 16px; font-size: 12px; min-height: 22px;
      border-top: 1px solid #eee;
    }
    #memo-status.ok { color: #1a7f3a; }
    #memo-status.err { color: #c0392b; }
    #memo-status.warn { color: #b8761c; }
    #memo-actions {
      padding: 10px 16px; border-top: 1px solid #eee;
      display: flex; gap: 8px; align-items: center;
    }
    #memo-add {
      padding: 9px 14px; background: #f4f6f9; color: #333;
      border: 1px solid #ddd; border-radius: 6px; cursor: pointer;
      font-size: 13px; font-weight: 500;
    }
    #memo-add:hover { background: #e9ecef; }
    #memo-save {
      flex: 1; padding: 9px; background: #4a90d9; color: #fff;
      border: none; border-radius: 6px; cursor: pointer; font-size: 14px;
      font-weight: 500;
    }
    #memo-save:hover { background: #3a7fc4; }
    #memo-save:disabled { background: #aaa; cursor: not-allowed; }
    #memo-save.dirty { background: #e67e22; }
    #memo-save.dirty:hover { background: #d35400; }
    #memo-token-btn {
      padding: 9px 12px; background: #f4f6f9; color: #555;
      border: 1px solid #ddd; border-radius: 6px; cursor: pointer;
      font-size: 12px;
    }
    #memo-token-btn:hover { background: #e9ecef; }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── DOM 빌드 ──────────────────────────────────────────────
  const fab = document.createElement("button");
  fab.id = "memo-fab";
  fab.title = "메모 (자료 보면서 떠오른 생각 적기)";
  fab.textContent = "📝";

  const panel = document.createElement("div");
  panel.id = "memo-panel";
  panel.innerHTML = `
    <div id="memo-header">
      <strong>📝 메모 인박스</strong>
      <div id="memo-header-actions">
        <button id="memo-reload" title="GitHub에서 다시 불러오기">↻</button>
        <button id="memo-close" title="닫기">×</button>
      </div>
    </div>
    <div id="memo-context">현재 페이지: -</div>
    <textarea id="memo-text" placeholder="로딩 중..."></textarea>
    <div id="memo-status"></div>
    <div id="memo-actions">
      <button id="memo-token-btn" title="GitHub 토큰 재설정">🔑</button>
      <button id="memo-add" title="현재 페이지 정보로 새 항목 추가 (맨 위)">+ 새 항목</button>
      <button id="memo-save" title="GitHub에 저장 (Ctrl+S)">💾 저장</button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const $ = (id) => document.getElementById(id);
  const ctx = $("memo-context");
  const textEl = $("memo-text");
  const saveBtn = $("memo-save");
  const addBtn = $("memo-add");
  const reloadBtn = $("memo-reload");
  const tokenBtn = $("memo-token-btn");
  const statusEl = $("memo-status");

  let currentSha = null;
  let loadedContent = "";

  // ── 헬퍼 ──────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }
  async function promptToken() {
    const cur = getToken();
    const hint = cur ? cur.slice(0, 12) + "..." : "";
    const t = prompt(
      "GitHub Personal Access Token 입력.\n" +
        "- github.com/settings/tokens?type=beta 에서 발급\n" +
        "- storywinner-lab repo만 선택, Contents: Read and write\n" +
        "- 빈 값 입력 후 OK = 삭제\n\n" +
        (hint ? `현재: ${hint}` : "토큰 없음"),
      ""
    );
    if (t === null) return;
    const token = t.trim();
    setToken(token);
    if (!token) {
      setStatus("토큰 삭제됨", "ok");
      return;
    }
    setStatus("토큰 검증 중...");
    const result = await diagnoseToken(token);
    setStatus(result.msg, result.ok ? "ok" : "err");
  }

  // ── 토큰 진단 ──────────────────────────────────────────────
  async function diagnoseToken(token) {
    // 1. 토큰으로 GitHub 사용자 정보 가져오기 — 어느 계정인지 확인
    let user = "?";
    try {
      const meRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (meRes.status === 401) {
        return { ok: false, msg: "❌ 토큰 자체가 무효 (401). 토큰 다시 발급." };
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        user = meData.login;
      }
    } catch (e) {}

    // 2. 토큰으로 storywinner-lab repo 조회
    const repoRes = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (repoRes.status === 404) {
      return {
        ok: false,
        msg: `❌ 토큰(${user})이 ${REPO} 못 봄. ` +
          `① 다른 계정 토큰? ② Repository access에 storywinner-lab 추가 안 됨?`,
      };
    }
    if (!repoRes.ok) {
      return { ok: false, msg: `❌ repo 조회 ${repoRes.status}` };
    }
    const repoData = await repoRes.json();

    // 3. Contents 쓰기 권한 — 실제로 PUT 흉내내서 확인 (no-op write test)
    // 가장 확실한 건 진짜 PUT을 한 번 해보는 것. 더미 파일 만들고 바로 지우자.
    const testPath = `notes/.token-test-${Date.now()}.tmp`;
    const testRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${testPath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "token write test (auto-cleanup)",
        content: btoa("test"),
        branch: BRANCH,
      }),
    });
    if (testRes.status === 404) {
      return {
        ok: false,
        msg: `❌ 토큰(${user})이 repo는 보지만 쓰기 거부. ` +
          `Permissions → Contents = Read and write 인지 확인.`,
      };
    }
    if (testRes.status === 403) {
      return { ok: false, msg: `❌ 권한 부족 (403). Contents 권한 확인.` };
    }
    if (!testRes.ok) {
      return { ok: false, msg: `❌ 쓰기 테스트 ${testRes.status}` };
    }
    // 테스트 성공 → 더미 파일 삭제
    const testData = await testRes.json();
    await fetch(`https://api.github.com/repos/${REPO}/contents/${testPath}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "token test cleanup",
        sha: testData.content.sha,
        branch: BRANCH,
      }),
    });
    return { ok: true, msg: `✅ 토큰 OK (계정: ${user}, repo 쓰기 가능)` };
  }
  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = kind || "";
  }
  function getCurrentPage() {
    const hash = location.hash || "#/";
    const path = hash.replace(/^#/, "");
    let label = path;
    const titleEl = document.querySelector(".markdown-section h1");
    if (titleEl) label = titleEl.textContent.trim();
    return { hash, path, label };
  }
  function refreshContext() {
    const p = getCurrentPage();
    ctx.textContent = "현재 페이지: " + p.label;
  }
  function nowLabel() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  }
  function markDirty() {
    saveBtn.classList.add("dirty");
    saveBtn.textContent = "💾 저장 *";
  }
  function markClean() {
    saveBtn.classList.remove("dirty");
    saveBtn.textContent = "💾 저장";
  }

  // ── GitHub API ──────────────────────────────────────────────
  async function ghGet(path) {
    // 토큰이 있으면 토큰으로 GET (rate limit / private repo / CDN 캐시 우회)
    const token = getToken();
    const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`;
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.status === 404) return null;
    if (res.status === 401) {
      throw new Error("토큰 무효 (401). 🔑 버튼으로 새 토큰 입력.");
    }
    if (res.status === 403) {
      throw new Error("불러오기 실패 403 (rate limit 또는 권한 부족).");
    }
    if (!res.ok) throw new Error(`불러오기 실패: ${res.status}`);
    return res.json();
  }
  async function ghPut(path, content, sha, message) {
    const token = getToken();
    if (!token) throw new Error("토큰이 없습니다. 🔑 버튼을 눌러 입력하세요.");
    const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
    const body = {
      message,
      content: b64encode(content),
      branch: BRANCH,
    };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      throw new Error("토큰이 잘못됨/만료. 🔑 버튼으로 새 토큰 입력하세요.");
    }
    if (res.status === 403) {
      throw new Error("권한 부족. 토큰의 Contents 권한이 'Read and write'인지 확인.");
    }
    if (res.status === 404) {
      throw new Error(
        "404: 토큰이 storywinner-lab repo에 접근 못 함. " +
          "토큰 설정에서 Repository access → 'Only select repositories'에 " +
          "storywinner-lab가 추가됐는지 확인."
      );
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`저장 실패: ${res.status} ${err.message || ""}`);
    }
    return res.json();
  }

  // ── 인박스 로드 ──────────────────────────────────────────────
  async function loadInbox() {
    setStatus("불러오는 중...");
    textEl.value = "";
    try {
      const file = await ghGet(INBOX_PATH);
      if (file && file.content) {
        loadedContent = b64decode(file.content);
        currentSha = file.sha;
      } else {
        loadedContent =
          `---\ntitle: "메모 인박스"\ndate: ${new Date().toISOString().slice(0, 10)}\n---\n\n` +
          `# 📝 메모 인박스\n\n` +
          `_여기에 메모가 누적됩니다. + 새 항목 버튼으로 빠른 추가, 또는 직접 편집._\n`;
        currentSha = null;
      }
      textEl.value = loadedContent;
      markClean();
      setStatus(currentSha ? "불러옴" : "신규 인박스", "ok");
    } catch (e) {
      setStatus(e.message, "err");
    }
  }

  // ── 새 항목 prepend ──────────────────────────────────────────────
  function addNewEntry() {
    const page = getCurrentPage();
    const ts = nowLabel();
    const pageLine =
      page.path && page.path !== "/"
        ? `> 보던 페이지: [${page.label}](${page.path})\n\n`
        : "";
    const entry = `## ${ts}\n${pageLine}\n\n---\n\n`;

    const cur = textEl.value;
    const fmMatch = cur.match(/^---\s*\n[\s\S]*?\n---\s*\n*(?:#[^\n]*\n*)?/);
    if (fmMatch) {
      const head = fmMatch[0];
      const rest = cur.slice(head.length);
      textEl.value = head + "\n" + entry + rest;
      // 새 항목 빈 줄에 커서 두기
      const cursorPos = head.length + 1 + entry.indexOf("\n\n---") - 1;
      textEl.focus();
      textEl.setSelectionRange(cursorPos, cursorPos);
    } else {
      textEl.value = entry + cur;
      textEl.focus();
      textEl.setSelectionRange(entry.length - 6, entry.length - 6);
    }
    markDirty();
    setStatus("새 항목 추가됨 — 내용 적고 저장", "warn");
  }

  // ── 저장 ──────────────────────────────────────────────
  async function saveInbox() {
    if (!getToken()) {
      setStatus("토큰 먼저 입력 (🔑 버튼)", "err");
      return;
    }
    const content = textEl.value;
    if (!content.trim()) {
      setStatus("내용이 비었음", "err");
      return;
    }

    saveBtn.disabled = true;
    setStatus("저장 중...");

    try {
      const ts = nowLabel();

      // 저장 직전에 항상 최신 sha를 받아옴 (충돌 방지)
      setStatus("최신 상태 확인 중...");
      const file = await ghGet(INBOX_PATH);
      let sha = null;
      if (file) {
        sha = file.sha;
        const remoteContent = b64decode(file.content);
        // 로드 시점 내용과 원격이 다르면 덮어쓰기 확인
        if (loadedContent && remoteContent !== loadedContent) {
          if (
            !confirm(
              "원격에 다른 변경사항이 있어요 (다른 기기에서 수정?).\n" +
                "내 텍스트로 덮어쓸까요?\n" +
                "(취소 = ↻로 원격 내용 다시 받기)"
            )
          ) {
            throw new Error("저장 취소됨");
          }
        }
      }

      setStatus("저장 중...");
      const result = await ghPut(INBOX_PATH, content, sha, `memo: ${ts}`);
      currentSha = result.content.sha;
      loadedContent = content;
      markClean();
      setStatus("저장됨 (1~2분 뒤 사이트 반영)", "ok");
    } catch (e) {
      setStatus(e.message, "err");
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ── 이벤트 ──────────────────────────────────────────────
  fab.addEventListener("click", async () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      refreshContext();
      await loadInbox();
      setTimeout(() => textEl.focus(), 50);
    }
  });
  $("memo-close").addEventListener("click", () => {
    if (saveBtn.classList.contains("dirty")) {
      if (!confirm("저장 안 된 변경사항이 있어요. 그래도 닫을까요?")) return;
    }
    panel.classList.remove("open");
  });
  reloadBtn.addEventListener("click", async () => {
    if (saveBtn.classList.contains("dirty")) {
      if (!confirm("저장 안 된 변경사항이 있어요. 다시 불러오면 사라져요. 계속?")) return;
    }
    await loadInbox();
  });
  saveBtn.addEventListener("click", saveInbox);
  addBtn.addEventListener("click", addNewEntry);
  tokenBtn.addEventListener("click", promptToken);

  textEl.addEventListener("input", () => {
    if (textEl.value !== loadedContent) markDirty();
    else markClean();
  });
  textEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveInbox();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveInbox();
    }
  });

  window.addEventListener("hashchange", refreshContext);

  // 페이지 떠날 때 dirty 경고
  window.addEventListener("beforeunload", (e) => {
    if (saveBtn.classList.contains("dirty")) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
