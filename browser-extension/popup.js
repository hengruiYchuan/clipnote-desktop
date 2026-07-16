const API = "http://127.0.0.1:32145/v1";
const pairing = document.querySelector("#pairing");
const vault = document.querySelector("#vault");
const tokenInput = document.querySelector("#token");
const searchInput = document.querySelector("#search");
const status = document.querySelector("#status");
const candidates = document.querySelector("#candidates");
const site = document.querySelector("#site");
let token = "";
let currentTab;
let searchTimer;

document.querySelector("#settings-toggle").addEventListener("click", () => {
  showPairing();
});

document.querySelector("#save-token").addEventListener("click", async () => {
  token = tokenInput.value.trim();
  if (!token) return;
  await chrome.storage.local.set({ clipnotePairingToken: token });
  showVault();
  await loadCandidates();
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadCandidates, 180);
});

async function initialize() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  site.textContent = safeHost(currentTab?.url);
  const stored = await chrome.storage.local.get("clipnotePairingToken");
  token = stored.clipnotePairingToken || "";
  if (!token) {
    showPairing();
    return;
  }
  showVault();
  await loadCandidates();
}

function showPairing() {
  pairing.hidden = false;
  vault.hidden = true;
  tokenInput.value = token;
  tokenInput.focus();
}

function showVault() {
  pairing.hidden = true;
  vault.hidden = false;
  searchInput.focus();
}

async function loadCandidates() {
  status.textContent = "正在搜索本机密码本";
  candidates.replaceChildren();
  try {
    const params = new URLSearchParams({ url: currentTab?.url || "", q: searchInput.value });
    const response = await api(`/candidates?${params}`);
    if (!response.length) {
      status.textContent = searchInput.value ? "没有匹配的密码条目" : "当前网站没有匹配账号";
      return;
    }
    status.textContent = `${response.length} 个可用账号`;
    for (const entry of response) candidates.append(createCandidate(entry));
  } catch (error) {
    status.textContent = error.message.includes("锁定")
      ? "请先在 ClipNote 中解锁密码本"
      : "ClipNote 未连接，请检查配对码和桌面程序";
  }
}

function createCandidate(entry) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "candidate";
  const mark = document.createElement("span");
  mark.className = "candidate__mark";
  mark.textContent = entry.title.slice(0, 1).toUpperCase();
  const copy = document.createElement("span");
  copy.className = "candidate__copy";
  const title = document.createElement("strong");
  title.textContent = entry.title;
  const username = document.createElement("small");
  username.textContent = entry.username || safeHost(entry.url) || "未填写账号";
  copy.append(title, username);
  const fill = document.createElement("span");
  fill.className = "candidate__fill";
  fill.textContent = "填充";
  button.append(mark, copy, fill);
  button.addEventListener("click", () => fillCredential(entry.id));
  return button;
}

async function fillCredential(id) {
  status.textContent = "正在填充";
  try {
    const credential = await api("/credential", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await chrome.tabs.sendMessage(currentTab.id, {
      type: "clipnote-fill",
      credential,
    });
    status.textContent = result?.filled ? "账号密码已填入" : "页面中没有可用的登录表单";
  } catch (error) {
    status.textContent = error.message || "填充失败";
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `请求失败：${response.status}`);
  return body;
}

function safeHost(value) {
  try { return new URL(value).hostname.replace(/^www\./, ""); }
  catch { return "当前页面"; }
}

initialize();
