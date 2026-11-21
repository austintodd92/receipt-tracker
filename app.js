import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { currentWeek, monthBreakdown, monthRange, parseDate, fmtDate } from "./budget.js";

const app = document.getElementById("app");

// Catch the most common setup mistake before anything else: a wrong config.js.
const CONFIG_PROBLEM = (() => {
  const url = String(SUPABASE_URL || "").trim();
  const key = String(SUPABASE_ANON_KEY || "").trim();
  if (url !== SUPABASE_URL || key !== SUPABASE_ANON_KEY) return "config.js has extra spaces inside the quotes.";
  if (url.includes("YOUR-PROJECT") || key.includes("YOUR-")) return "config.js still has the placeholder values. Paste in your Project URL and anon/publishable key.";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
    return `SUPABASE_URL should look like https://abcdefgh.supabase.co (no slash or path at the end). It is currently: ${url}`;
  if (key.length < 30) return "SUPABASE_ANON_KEY looks too short. Copy the whole key again.";
  return "";
})();
if (CONFIG_PROBLEM) {
  app.innerHTML = `<h1>Setup problem</h1><div class="notice">${CONFIG_PROBLEM.replace(/</g, "&lt;")}</div>`;
  throw new Error(CONFIG_PROBLEM);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
const tabs = document.getElementById("tabs");

const state = {
  user: null,
  household: null,
  members: [],
  receipts: [], // current month
  tab: "home",
  summaryMonth: null, // Date (1st of month) shown on Summary
};

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return neg ? `−${s}` : s;
};
const shortDate = (s) => parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const weekLabel = (w) => (w.start === w.end ? shortDate(w.startDate) : `${shortDate(w.startDate)} – ${shortDate(w.endDate)}`);
const monthName = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const todayStr = () => fmtDate(new Date());
const memberName = (uid) => state.members.find((m) => m.user_id === uid)?.display_name || "";

function setTab(tab) {
  state.tab = tab;
  tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  render();
}
tabs.addEventListener("click", (e) => {
  const t = e.target.closest("button")?.dataset.tab;
  if (t) setTab(t);
});

// ---------- data ----------
async function loadHousehold() {
  const { data: mem, error } = await supabase
    .from("household_members")
    .select("household_id, user_id, display_name");
  if (error) throw error;
  const mine = mem.find((m) => m.user_id === state.user.id);
  if (!mine) {
    state.household = null;
    return;
  }
  state.members = mem.filter((m) => m.household_id === mine.household_id);
  const { data: hh, error: e2 } = await supabase
    .from("households")
    .select("id, name, monthly_budget")
    .eq("id", mine.household_id)
    .single();
  if (e2) throw e2;
  state.household = hh;
}

async function loadReceipts(year, monthIndex) {
  const { from, to } = monthRange(year, monthIndex);
  const { data, error } = await supabase
    .from("receipts")
    .select("id, user_id, restaurant, total, spent_on, created_at")
    .eq("household_id", state.household.id)
    .gte("spent_on", from)
    .lte("spent_on", to)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function refresh() {
  const now = new Date();
  await loadHousehold();
  if (state.household) state.receipts = await loadReceipts(now.getFullYear(), now.getMonth());
}

// ---------- views ----------
function render() {
  if (!state.user) return renderLogin();
  if (!state.household) return renderNoHousehold();
  tabs.classList.remove("hidden");
  if (state.tab === "home") return renderHome();
  if (state.tab === "summary") return renderSummary();
  if (state.tab === "settings") return renderSettings();
}

function renderLogin(msg = "") {
  tabs.classList.add("hidden");
  app.innerHTML = `
    <h1>Dining Tracker</h1>
    <form class="card stack" id="login">
      ${msg ? `<div class="notice">${esc(msg)}</div>` : ""}
      <div><label for="email">Email</label>
        <input id="email" type="email" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required /></div>
      <div><label for="pw">Password</label>
        <input id="pw" type="password" autocomplete="current-password" required /></div>
      <button class="primary" type="submit">Sign in</button>
    </form>`;
  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("pw").value,
    });
    if (error) {
      console.error(error);
      const m = String(error.message || "");
      let msg = "That email or password didn't work.";
      if (/confirm/i.test(m)) msg = "This email hasn't been confirmed in Supabase yet.";
      if (/fetch|load failed|network/i.test(m))
        msg = "Couldn't reach the server. If other phones can sign in, a VPN, content blocker or iCloud Private Relay on this phone may be blocking it.";
      renderLogin(`${msg} (Details: ${m || error.status || "unknown"})`);
    }
    // success is handled by onAuthStateChange
  });
}

function renderNoHousehold() {
  tabs.classList.add("hidden");
  app.innerHTML = `
    <h1>Almost there</h1>
    <div class="card stack">
      <p>You're signed in as <b>${esc(state.user.email)}</b>, but this login isn't linked to a budget yet.</p>
      <p class="muted small">Rerun <code>supabase/setup.sql</code> with this email in STEP 3, then reopen the app.</p>
      <button class="secondary" id="out">Sign out</button>
    </div>`;
  document.getElementById("out").onclick = () => supabase.auth.signOut();
}

function renderHome() {
  const { week, month } = currentWeek(state.household.monthly_budget, state.receipts);
  const over = week.left < 0;
  const pct = week.available > 0 ? Math.min(100, Math.max(0, (week.spent / week.available) * 100)) : 100;
  const weekReceipts = state.receipts.filter((r) => r.spent_on >= week.startDate && r.spent_on <= week.endDate);

  let carryLine = "";
  if (week.carryIn > 0.004) carryLine = `<span class="pill ok">+${money(week.carryIn)} rolled over</span>`;
  if (week.carryIn < -0.004) carryLine = `<span class="pill warn">${money(week.carryIn)} from overspending</span>`;

  app.innerHTML = `
    <h1>This week</h1>
    <div class="card">
      <div class="muted small">${weekLabel(week)}</div>
      <div class="big ${over ? "neg" : ""}">${money(week.left)}</div>
      <div class="muted">${over ? "over budget this week" : "left to spend eating out"}</div>
      <div class="bar ${over ? "over" : ""}"><div style="width:${pct}%"></div></div>
      <div class="row small muted"><span>Spent ${money(week.spent)}</span><span>of ${money(week.available)}</span></div>
      ${carryLine ? `<div style="margin-top:12px">${carryLine}</div>` : ""}
    </div>

    <div style="margin-top:16px">
      <button class="primary" id="add">＋  Add a meal</button>
    </div>

    <h2>This week's meals</h2>
    <div class="card">
      ${weekReceipts.length ? `<ul class="list">${weekReceipts.map(receiptRow).join("")}</ul>`
        : `<div class="muted">No meals out yet this week.</div>`}
    </div>

    <p class="muted small" style="text-align:center;margin-top:20px">
      ${monthName(new Date())}: ${money(month.monthSpent)} of ${money(month.monthBudget)} spent
    </p>`;

  document.getElementById("add").onclick = () => renderConfirm({ total: "", restaurant: "", spent_on: todayStr() });
  bindReceiptRows();
}

function receiptRow(r) {
  const who = state.members.length > 1 ? memberName(r.user_id) : "";
  return `<li data-id="${r.id}">
      <div><div>${esc(r.restaurant || "Meal out")}</div>
      <div class="muted small">${shortDate(r.spent_on)}${who ? " · " + esc(who) : ""}</div></div>
      <div class="amt">${money(Number(r.total))}</div></li>`;
}

function bindReceiptRows(source = state.receipts) {
  app.querySelectorAll(".list li[data-id]").forEach((li) => {
    li.onclick = () => {
      const r = source.find((x) => x.id === li.dataset.id);
      if (r) renderConfirm({ ...r }, { editing: true });
    };
  });
}

// ---------- confirm / edit ----------
function renderConfirm(r, { editing = false } = {}) {
  tabs.classList.add("hidden");
  app.innerHTML = `
    <h1>${editing ? "Edit meal" : "Add a meal"}</h1>
    <form class="card stack" id="f">
      <div><label for="total">Total paid, including tip</label>
        <div class="money"><span>$</span>
        <input id="total" inputmode="decimal" placeholder="0.00" value="${esc(r.total)}" required ${editing ? "" : "autofocus"} /></div></div>
      <div><label for="rest">Restaurant</label>
        <input id="rest" value="${esc(r.restaurant)}" placeholder="Restaurant name" /></div>
      <div><label for="date">Date</label>
        <input id="date" type="date" value="${esc(r.spent_on)}" max="${todayStr()}" required /></div>
      <div id="monthwarn"></div>
      <button class="primary" type="submit">${editing ? "Save changes" : "Save meal"}</button>
      ${editing ? `<button class="danger" type="button" id="del">Delete</button>` : ""}
      <button class="link" type="button" id="cancel">Cancel</button>
    </form>`;

  const dateInput = document.getElementById("date");
  const warn = () => {
    const d = dateInput.value ? parseDate(dateInput.value) : new Date();
    const now = new Date();
    const other = d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear();
    document.getElementById("monthwarn").innerHTML = other
      ? `<div class="notice info">This counts toward ${monthName(d)}, not this month.</div>` : "";
  };
  dateInput.addEventListener("change", warn);
  warn();

  document.getElementById("cancel").onclick = () => setTab(state.tab);
  if (editing) {
    document.getElementById("del").onclick = async () => {
      if (!window.confirm("Delete this meal?")) return;
      const { error } = await supabase.from("receipts").delete().eq("id", r.id);
      if (error) return alertErr(error);
      await refresh();
      setTab(state.tab);
    };
  }

  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const total = Number(String(document.getElementById("total").value).replace(/[^0-9.]/g, ""));
    if (!(total > 0)) return window.alert("Please enter the total.");
    const row = {
      restaurant: document.getElementById("rest").value.trim(),
      total: Math.round(total * 100) / 100,
      spent_on: dateInput.value || todayStr(),
    };
    e.target.querySelector("button[type=submit]").disabled = true;
    const q = editing
      ? supabase.from("receipts").update(row).eq("id", r.id)
      : supabase.from("receipts").insert({ ...row, household_id: state.household.id });
    const { error } = await q;
    if (error) {
      e.target.querySelector("button[type=submit]").disabled = false;
      return alertErr(error);
    }
    await refresh();
    setTab(editing ? state.tab : "home");
  });
}

function alertErr(error) {
  console.error(error);
  window.alert("Something went wrong saving. Check your internet and try again.");
}

// ---------- summary ----------
async function renderSummary() {
  const now = new Date();
  if (!state.summaryMonth) state.summaryMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const m = state.summaryMonth;
  const isThisMonth = m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth();

  app.innerHTML = `<h1>Summary</h1><div class="spinner"></div>`;
  let receipts;
  try {
    receipts = isThisMonth ? state.receipts : await loadReceipts(m.getFullYear(), m.getMonth());
  } catch (err) {
    console.error(err);
    app.innerHTML = `<h1>Summary</h1><div class="notice">Couldn't load. Check your internet.</div>`;
    return;
  }
  if (state.tab !== "summary") return;

  const b = monthBreakdown(state.household.monthly_budget, receipts, m.getFullYear(), m.getMonth());
  const today = todayStr();
  const weeks = b.weeks.filter((w) => !isThisMonth || w.startDate <= today);

  app.innerHTML = `
    <h1>Summary</h1>
    <div class="monthnav">
      <button id="prev">‹</button><b>${monthName(m)}</b>
      <button id="next" ${isThisMonth ? "disabled" : ""}>›</button>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="row"><span class="muted">Spent</span><b>${money(b.monthSpent)}</b></div>
      <div class="row" style="margin-top:6px"><span class="muted">Budget</span><span>${money(b.monthBudget)}</span></div>
      <div class="row" style="margin-top:6px"><span class="muted">${b.monthLeft < 0 ? "Over" : "Left"}</span>
        <b class="${b.monthLeft < 0 ? "neg" : ""}">${money(Math.abs(b.monthLeft))}</b></div>
      <div class="row" style="margin-top:6px"><span class="muted">Meals out</span><span>${receipts.length}</span></div>
    </div>

    <h2>Week by week</h2>
    <div class="card">
      ${weeks.slice().reverse().map((w) => {
        const current = isThisMonth && today >= w.startDate && today <= w.endDate;
        const n = receipts.filter((r) => r.spent_on >= w.startDate && r.spent_on <= w.endDate).length;
        return `<div class="week ${current ? "current" : ""}">
          <div class="row"><b>${weekLabel(w)}${current ? " (now)" : ""}</b>
            <b class="${w.left < 0 ? "neg" : ""}">${w.left < 0 ? money(w.left) + " over" : money(w.left) + " left"}</b></div>
          <div class="muted small">Spent ${money(w.spent)} on ${n} meal${n === 1 ? "" : "s"} · Budget ${money(w.allowance)}${
            Math.abs(w.carryIn) > 0.004
              ? w.carryIn > 0 ? ` · +${money(w.carryIn)} rolled over` : ` · ${money(w.carryIn)} from last week`
              : ""}</div>
        </div>`;
      }).join("")}
    </div>

    <h2>All meals</h2>
    <div class="card">
      ${receipts.length ? `<ul class="list">${receipts.map(receiptRow).join("")}</ul>` : `<div class="muted">No meals out.</div>`}
    </div>`;

  document.getElementById("prev").onclick = () => {
    state.summaryMonth = new Date(m.getFullYear(), m.getMonth() - 1, 1);
    renderSummary();
  };
  document.getElementById("next").onclick = () => {
    if (isThisMonth) return;
    state.summaryMonth = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    renderSummary();
  };
  bindReceiptRows(receipts);
}

// ---------- settings ----------
function renderSettings() {
  const hh = state.household;
  app.innerHTML = `
    <h1>Settings</h1>
    <form class="card stack" id="bf">
      <div><label for="budget">Monthly eating-out budget</label>
        <div class="money"><span>$</span>
        <input id="budget" inputmode="decimal" value="${Number(hh.monthly_budget).toFixed(2)}" /></div></div>
      <div class="muted small">Split across the month by days. Leftovers roll into next week, overspending comes out of next week, and it all resets on the 1st.</div>
      <button class="primary" type="submit">Save budget</button>
    </form>

    <h2>Who's on this budget</h2>
    <div class="card"><ul class="list">
      ${state.members.map((m) => `<li style="cursor:default"><span>${esc(m.display_name || "—")}</span>
        <span class="muted small">${m.user_id === state.user.id ? "you" : ""}</span></li>`).join("")}
    </ul></div>

    <div style="margin-top:24px"><button class="secondary" id="out">Sign out</button></div>
    <p class="muted small" style="text-align:center">Signed in as ${esc(state.user.email)}</p>`;

  document.getElementById("bf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = Number(String(document.getElementById("budget").value).replace(/[^0-9.]/g, ""));
    if (!(v >= 0)) return;
    const { error } = await supabase.from("households").update({ monthly_budget: v }).eq("id", hh.id);
    if (error) return alertErr(error);
    hh.monthly_budget = v;
    window.alert("Budget saved.");
  });
  document.getElementById("out").onclick = () => supabase.auth.signOut();
}

// ---------- start ----------
async function onSession(session) {
  state.user = session?.user ?? null;
  if (!state.user) {
    state.household = null;
    return render();
  }
  app.innerHTML = `<div class="spinner"></div>`;
  try {
    await refresh();
  } catch (err) {
    console.error(err);
    const detail = [err?.code, err?.message, err?.hint].filter(Boolean).join(" — ");
    app.innerHTML = `<h1>Dining Tracker</h1>
      <div class="card stack">
        <div class="notice">Couldn't load your budget.</div>
        <div class="muted small">Details: ${esc(detail || String(err))}</div>
        <button class="primary" id="retry">Try again</button>
        <button class="link" id="out">Sign out</button>
      </div>`;
    document.getElementById("retry").onclick = () => onSession(session);
    document.getElementById("out").onclick = () => supabase.auth.signOut();
    return;
  }
  setTab("home");
}

let lastUserId;
supabase.auth.onAuthStateChange((event, session) => {
  const id = session?.user?.id ?? null;
  if (event === "TOKEN_REFRESHED" && id === lastUserId) return;
  if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
    if (event === "SIGNED_IN" && id === lastUserId && state.household) return;
    lastUserId = id;
    // Run outside the auth callback to avoid supabase-js deadlocks.
    setTimeout(() => onSession(session), 0);
  }
});

// When the app is reopened from the home screen, pull the latest numbers
// (so each parent sees what the other one added).
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !state.household) return;
  // Don't interrupt someone in the middle of checking or editing a receipt.
  if (tabs.classList.contains("hidden") || !["home", "summary"].includes(state.tab)) return;
  try {
    await refresh();
    render();
  } catch {}
});
