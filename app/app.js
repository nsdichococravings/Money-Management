// FreedomDay app: login, Home, Money, Dues, Goals & Investments, Ask AI, Settings.
import { createApi } from "./api.js";
import { whatIf, monthsUntil, monthlyAverages, estimateFreedom, debtPlan, addMonths, forecast } from "./engine.js";
import { ring, donut, legend, weekBars, allocBar, installTooltips, countUp } from "./charts.js";

const config = window.FREEDOMDAY_CONFIG || window.WEALTHPILOT_CONFIG || {};
let api;
let user = null;
let cache = { categories: [], accounts: [] };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const rupees = (paise) => inr.format(Math.round((Number(paise) || 0) / 100));
const compact = (paise) => {
  const r = Math.abs((Number(paise) || 0) / 100), sign = paise < 0 ? "−" : "";
  if (r >= 1e7) return `${sign}₹${(r / 1e7).toFixed(r >= 1e8 ? 0 : 2)} Cr`;
  if (r >= 1e5) return `${sign}₹${(r / 1e5).toFixed(r >= 1e6 ? 1 : 2)} L`;
  return sign + inr.format(r);
};
const toPaise = (v) => Math.round(parseFloat(String(v).replace(/[,₹\s]/g, "")) * 100) || 0;
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => isoOf(new Date());
const fmtDate = (iso, opts = { day: "numeric", month: "short" }) => iso ? new Date(iso).toLocaleDateString("en-IN", opts) : "";
const daysFrom = (iso) => Math.round((new Date(iso) - new Date(todayIso())) / 86400000);
const whenText = (iso) => { const n = daysFrom(iso); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n < 0 ? `${-n}d late` : `In ${n} days`; };
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
const yearsText = (y) => (y == null ? "—" : y === 0 ? "Reached!" : `${y} yrs`);

const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICON = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  money: svg('<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 11h-5a2 2 0 0 0 0 4h5z"/>'),
  dues: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h2v2H8z"/>'),
  grow: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  ai: svg('<path d="M12 3l1.9 4.7L18.5 9.5l-4.6 1.8L12 16l-1.9-4.7L5.5 9.5l4.6-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  logo: svg('<path d="M8 20V4h10M8 12h7"/>', 'stroke-width="2.8"'),
  income: svg('<path d="M17 7 7 17M7 8v9h9"/>'),
  fixed: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>'),
  kids: svg('<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
  daily: svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6"/>'),
  sinking: svg('<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'),
  invest: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  discretionary: svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>'),
  transfer: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  bill: svg('<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2z"/><path d="M8 9h8M8 13h6"/>'),
  emi: svg('<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2 21 7H3z"/>'),
  card: svg('<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  alert: svg('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  bulb: svg('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  wallet: svg('<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M16 13h2M2 10h20"/>'),
  goal: svg('<path d="M4 22V4M4 4h12l-2 4 2 4H4"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
};
const BUCKET = {
  fixed: { label: "Bills & EMIs", color: "var(--c-1)" },
  kids: { label: "Kids' education", color: "var(--c-2)" },
  daily: { label: "Daily needs", color: "var(--c-3)" },
  sinking: { label: "Holidays & goals", color: "var(--c-4)" },
  invest: { label: "Investing", color: "var(--c-5)" },
  discretionary: { label: "Lifestyle", color: "var(--c-6)" },
  income: { label: "Income", color: "var(--good-text)" },
  transfer: { label: "Transfer", color: "var(--muted)" },
};
const TYPE = { bill: { icon: ICON.bill, color: "var(--c-1)" }, emi: { icon: ICON.emi, color: "var(--c-6)" }, card: { icon: ICON.card, color: "var(--c-2)" } };
const tile = (icon, color = "var(--accent)") => `<div class="tile" style="--tile:${color}">${icon}</div>`;

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg; t.setAttribute("role", "status");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function sheet(title, html, onMount) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-backdrop";
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grip"></div><h3>${esc(title)}</h3>${html}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(wrap);
  onMount?.(wrap.querySelector(".sheet"), close);
  wrap.querySelector("input,select,textarea,button")?.focus();
  return close;
}

// fields: [{ name, label, type, options:[[value,label]], value, required, hint, step, min, max }]
function fieldHtml(x) {
  const req = x.required ? "required" : "";
  let input;
  if (x.type === "select") {
    input = `<select name="${x.name}" ${req}>${x.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(x.value ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  } else {
    const t = x.type === "money" ? "text" : (x.type || "text");
    const extra = x.type === "money" ? 'inputmode="decimal" placeholder="₹ 0"' : "";
    input = `<input name="${x.name}" type="${t}" ${extra} value="${esc(x.value ?? "")}" ${req} ${x.step ? `step="${x.step}"` : ""} ${x.min != null ? `min="${x.min}"` : ""} ${x.max != null ? `max="${x.max}"` : ""} ${x.placeholder ? `placeholder="${esc(x.placeholder)}"` : ""}>`;
  }
  return `<label class="field">${esc(x.label)}${input}${x.hint ? `<span class="hint">${esc(x.hint)}</span>` : ""}</label>`;
}
function formHtml(fields, submitLabel) {
  return `<form class="form">${fields.map((f) => Array.isArray(f) ? `<div class="split">${f.map(fieldHtml).join("")}</div>` : fieldHtml(f)).join("")}
    <div class="error hidden"></div><button class="btn block" type="submit">${esc(submitLabel)}</button></form>`;
}

// opts.onDelete adds a Delete button (asks first). opts.deleteText is the question.
function formSheet(title, fields, submitLabel, onSubmit, opts = {}) {
  const del = opts.onDelete ? `<button type="button" class="btn danger block" data-delete style="margin-top:10px">${ICON.trash} ${esc(opts.deleteLabel || "Delete")}</button>` : "";
  sheet(title, formHtml(fields, submitLabel) + del, (root, close) => {
    const form = $("form", root);
    $("[data-delete]", root)?.addEventListener("click", async (e) => {
      if (!confirm(opts.deleteText || "Delete this? This cannot be undone.")) return;
      const err = $(".error", form);
      e.currentTarget.disabled = true;
      try { await opts.onDelete(); close(); toast(opts.deletedToast || "Deleted"); render(); }
      catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); e.currentTarget.disabled = false; }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", form), err = $(".error", form);
      const values = Object.fromEntries(new FormData(form).entries());
      btn.disabled = true; err.classList.add("hidden");
      try {
        await onSubmit(values);
        close();
        render();
      } catch (ex) {
        err.textContent = ex.message; err.classList.remove("hidden");
      } finally { btn.disabled = false; }
    });
  });
}

const editBtn = (kind, id, label = "Edit") => `<button class="icon-btn" style="width:34px;height:34px" aria-label="${esc(label)}" data-edit="${kind}" data-id="${esc(id)}">${ICON.edit.replace("<svg", '<svg width="16" height="16"')}</button>`;
const rupeesIn = (paise) => (paise ? Math.round(paise) / 100 : "");
const FREQ = { weekly: "Weekly", monthly: "Monthly", quarterly: "Every 3 months", half_yearly: "Every 6 months", yearly: "Yearly" };
const LOAN_TYPES = [["home", "Home"], ["car", "Car"], ["personal", "Personal"], ["education", "Education"], ["gold", "Gold"], ["business", "Business"], ["other", "Other"]];
const GOAL_KINDS = [["education", "Kids' education"], ["holiday", "Holiday"], ["emergency", "Emergency fund"], ["festival", "Festival / wedding"], ["purchase", "Big purchase"], ["debt_free", "Become debt-free"], ["financial_freedom", "Financial freedom"], ["other", "Other"]];
const ASSET_TYPES = [["equity_mf", "Equity mutual fund"], ["debt_mf", "Debt mutual fund"], ["stock", "Stocks"], ["fd", "Fixed deposit"], ["rd", "Recurring deposit"], ["ppf", "PPF"], ["epf", "EPF"], ["nps", "NPS"], ["gold", "Gold"], ["real_estate", "Real estate"], ["other", "Other"]];
const spendCategoryOptions = () => cache.categories.filter((c) => !["income", "transfer"].includes(c.bucket)).map((c) => [c.id, c.name]);
const dayOk = (v, label) => { const n = Number(v); if (!(n >= 1 && n <= 31)) throw new Error(`${label} must be between 1 and 31.`); return n; };
const moneyOk = (v, label) => { const p = toPaise(v); if (p <= 0) throw new Error(`Enter ${label} more than zero.`); return p; };

const EDITORS = {
  loan: (l) => formSheet(`Edit ${l.lender} loan`, [
    [{ name: "loan_type", label: "Type", type: "select", options: LOAN_TYPES, value: l.loan_type },
     { name: "lender", label: "Bank / lender", required: true, value: l.lender }],
    [{ name: "emi", label: "EMI amount", type: "money", required: true, value: rupeesIn(l.emi_paise) },
     { name: "emi_day", label: "EMI day of month", type: "number", min: 1, max: 31, required: true, value: l.emi_day }],
    [{ name: "principal", label: "Original loan", type: "money", required: true, value: rupeesIn(l.principal_paise) },
     { name: "outstanding", label: "Still to pay", type: "money", required: true, value: rupeesIn(l.outstanding_paise) }],
    [{ name: "rate", label: "Interest % / year", type: "number", step: "0.01", required: true, value: (l.interest_rate_bps / 100).toFixed(2) },
     { name: "tenure", label: "Tenure (months)", type: "number", min: 1, required: true, value: l.tenure_months }],
    [{ name: "start_date", label: "Loan start date", type: "date", required: true, value: l.start_date },
     { name: "status", label: "Status", type: "select", options: [["active", "Active"], ["closed", "Closed / fully paid"]], value: l.status }],
  ], "Save changes", (v) => api.updateLoan(l.id, {
    loan_type: v.loan_type, lender: v.lender.trim(), emi_paise: moneyOk(v.emi, "the EMI"), emi_day: dayOk(v.emi_day, "EMI day"),
    principal_paise: moneyOk(v.principal, "the loan amount"), outstanding_paise: Math.max(toPaise(v.outstanding), 0),
    interest_rate_bps: Math.round(Number(v.rate) * 100), tenure_months: Number(v.tenure), start_date: v.start_date, status: v.status,
  }), { onDelete: () => api.deleteLoan(l.id), deleteLabel: "Delete loan", deleteText: `Delete the ${l.lender} loan? Past EMI payments stay in your transactions.` }),

  async bill(b) {
    const next = await api.billNextOpen(b);
    formSheet(`Edit ${b.name}`, [
      { name: "name", label: "Name", required: true, value: b.name },
      [{ name: "amount", label: "Amount", type: "money", required: true, value: rupeesIn(b.amount_paise) },
       { name: "frequency", label: "How often", type: "select", value: b.frequency, options: Object.entries(FREQ) }],
      { name: "category_id", label: "Category", type: "select", options: spendCategoryOptions(), value: b.category_id },
      [{ name: "next_due_date", label: "Next due date", type: "date", required: true, value: next },
       { name: "autopay", label: "Autopay?", type: "select", options: [["false", "No"], ["true", "Yes"]], value: String(!!b.autopay) }],
    ], "Save changes", (v) => api.updateBill(b.id, {
      name: v.name.trim(), amount_paise: moneyOk(v.amount, "an amount"), frequency: v.frequency, category_id: Number(v.category_id),
      next_due_date: v.next_due_date, due_day: new Date(v.next_due_date).getDate(), autopay: v.autopay === "true",
    }), { onDelete: () => api.deleteBill(b.id), deleteLabel: "Delete bill", deleteText: `Delete "${b.name}" and its upcoming dues? Past payments stay in your transactions.` });
  },

  card: (c) => formSheet(`Edit ${c.issuer} ••${c.last4}`, [
    [{ name: "issuer", label: "Bank", required: true, value: c.issuer },
     { name: "last4", label: "Last 4 digits", required: true, value: c.last4 }],
    { name: "limit", label: "Credit limit", type: "money", required: true, value: rupeesIn(c.credit_limit_paise) },
    [{ name: "statement_day", label: "Statement day", type: "number", min: 1, max: 31, required: true, value: c.statement_day },
     { name: "due_day", label: "Due day", type: "number", min: 1, max: 31, required: true, value: c.due_day }],
  ], "Save changes", (v) => {
    if (!/^\d{4}$/.test(v.last4)) throw new Error("Enter exactly the last 4 digits.");
    return api.updateCard(c.id, { issuer: v.issuer.trim(), last4: v.last4, credit_limit_paise: moneyOk(v.limit, "the limit"),
      statement_day: dayOk(v.statement_day, "Statement day"), due_day: dayOk(v.due_day, "Due day") });
  }, { onDelete: async () => { await api.deleteCard(c); await refreshCache(); }, deleteLabel: "Delete card",
       deleteText: `Delete the ${c.issuer} ••${c.last4} card and its card bills? Past transactions stay.` }),

  async statement(st) {
    const s0 = await api.statement(st.id);
    formSheet("Edit card bill", [
      [{ name: "total", label: "Total due", type: "money", required: true, value: rupeesIn(s0.total_due_paise) },
       { name: "min", label: "Minimum due", type: "money", required: true, value: rupeesIn(s0.min_due_paise) }],
      [{ name: "statement_date", label: "Statement date", type: "date", required: true, value: s0.statement_date },
       { name: "due_date", label: "Pay by", type: "date", required: true, value: s0.due_date }],
    ], "Save changes", (v) => {
      const total = moneyOk(v.total, "the total");
      const paid = s0.paid_paise || 0;
      return api.updateStatement(st.id, { total_due_paise: total, min_due_paise: toPaise(v.min), statement_date: v.statement_date, due_date: v.due_date,
        status: paid >= total ? "paid" : paid > 0 ? "partial" : "open" });
    }, { onDelete: () => api.deleteStatement(st.id), deleteLabel: "Delete card bill" });
    const sheetEl = document.querySelector(".sheet:last-of-type") || document.querySelector(".sheet");
    sheetEl?.insertAdjacentHTML("beforeend", `<button type="button" class="btn ghost block" data-edit-card style="margin-top:10px">${ICON.card} Edit card details</button>`);
    sheetEl?.querySelector("[data-edit-card]")?.addEventListener("click", async () => {
      const card = (await api.cards()).find((c) => c.id === s0.card_id);
      if (!card) return toast("Card not found");
      document.querySelector(".sheet-backdrop")?.remove();
      EDITORS.card(card);
    });
  },

  goal: (g) => formSheet(`Edit ${g.name}`, [
    { name: "kind", label: "Type", type: "select", options: GOAL_KINDS, value: g.kind },
    { name: "name", label: "Name", required: true, value: g.name },
    [{ name: "target", label: "Amount needed", type: "money", required: true, value: rupeesIn(g.target_paise) },
     { name: "saved", label: "Saved so far", type: "money", value: rupeesIn(g.saved_paise) }],
    { name: "target_date", label: "Needed by", type: "date", required: true, value: g.target_date },
  ], "Save changes", (v) => {
    const target = moneyOk(v.target, "an amount"), saved = Math.max(toPaise(v.saved || 0), 0);
    return api.updateGoal(g.id, { kind: v.kind, name: v.name.trim(), target_paise: target, saved_paise: saved, target_date: v.target_date,
      status: saved >= target ? "achieved" : "active" });
  }, { onDelete: () => api.deleteGoal(g.id), deleteLabel: "Delete goal", deleteText: `Delete the goal "${g.name}"? Investments linked to it will count towards freedom instead.` }),

  holding: (h, goals) => formSheet(`Edit ${h.name}`, [
    { name: "asset_class", label: "Type", type: "select", options: ASSET_TYPES, value: h.asset_class },
    { name: "name", label: "Name", required: true, value: h.name },
    [{ name: "invested", label: "Amount invested", type: "money", required: true, value: rupeesIn(h.invested_paise) },
     { name: "current", label: "Value today", type: "money", required: true, value: rupeesIn(h.current_paise) }],
    { name: "sip", label: "Monthly SIP", type: "money", value: rupeesIn(h.sip_paise) },
    { name: "goal_id", label: "For a goal?", type: "select", value: h.goal_id || "", options: [["", "No, for financial freedom"], ...goals.filter((g) => g.kind !== "financial_freedom").map((g) => [g.id, g.name])] },
  ], "Save changes", (v) => api.updateHolding(h.id, { asset_class: v.asset_class, name: v.name.trim(), invested_paise: Math.max(toPaise(v.invested), 0),
    current_paise: Math.max(toPaise(v.current), 0), sip_paise: Math.max(toPaise(v.sip || 0), 0), goal_id: v.goal_id || null }),
  { onDelete: () => api.deleteHolding(h.id), deleteLabel: "Delete investment" }),

  txn(t) {
    const income = t.amount_paise > 0;
    formSheet(income ? "Edit income" : "Edit expense", [
      { name: "amount", label: "Amount", type: "money", required: true, value: rupeesIn(Math.abs(t.amount_paise)) },
      { name: "category_id", label: "Category", type: "select", options: categoryOptions(income ? "income" : "expense"), value: t.category_id },
      { name: "merchant", label: income ? "From" : "Where / what", value: t.merchant || "" },
      [{ name: "account_id", label: "Account", type: "select", options: accountOptions((a) => a.kind !== "loan" && a.kind !== "investment"), value: t.account_id },
       { name: "txn_date", label: "Date", type: "date", required: true, value: t.txn_date }],
    ], "Save changes", (v) => {
      const amt = moneyOk(v.amount, "an amount");
      return api.updateTransaction(t, { amount_paise: income ? amt : -amt, category_id: Number(v.category_id), merchant: v.merchant || null,
        account_id: v.account_id, txn_date: v.txn_date });
    }, { onDelete: () => api.deleteTransaction(t), deleteLabel: income ? "Delete income" : "Delete expense" });
  },

  account: (a) => formSheet(`Edit ${a.name}`, [
    [{ name: "name", label: "Name", required: true, value: a.name },
     { name: "last4", label: "Last 4 digits", value: a.last4 || "", hint: "Optional" }],
  ], "Save changes", async (v) => {
    if (v.last4 && !/^\d{4}$/.test(v.last4)) throw new Error("Enter exactly 4 digits, or leave it empty.");
    await api.updateAccount(a.id, { name: v.name.trim(), last4: v.last4 || null }); await refreshCache();
  }, { onDelete: async () => {
      if (cache.accounts.filter((x) => ["bank", "cash", "wallet"].includes(x.kind)).length <= 1 && ["bank", "cash", "wallet"].includes(a.kind)) throw new Error("Keep at least one bank, cash or wallet account.");
      await api.updateAccount(a.id, { is_active: false }); await refreshCache();
    }, deleteLabel: "Remove account", deletedToast: "Account removed", deleteText: `Remove "${a.name}"? Its past transactions stay in your history.` }),
};
// lists: { kind: arrayOfItems }. Opens the matching editor for a clicked [data-edit] button.
function bindEdit(root, lists, extra) {
  root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
    const kind = b.dataset.edit, item = (lists[kind] || []).find((x) => String(x.id) === b.dataset.id);
    if (item) EDITORS[kind](item, extra);
  }));
}

const categoryOptions = (kind) => cache.categories
  .filter((c) => (kind === "income" ? c.bucket === "income" : !["income", "transfer"].includes(c.bucket)))
  .map((c) => [c.id, c.name]);
const accountOptions = (filter = () => true) => cache.accounts.filter(filter).map((a) => [a.id, a.name + (a.last4 ? ` ••${a.last4}` : "")]);

// ---------------------------------------------------------------------------
// theme (dark first; Settings can switch to light or follow the phone)
// ---------------------------------------------------------------------------
const THEME_KEY = "wp-theme";
const getTheme = () => { try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; } };
function applyTheme(choice = getTheme()) {
  const t = choice === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : choice;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#eef0f3" : "#0a0b0d");
}
function setTheme(choice) { try { localStorage.setItem(THEME_KEY, choice); } catch { /* private mode */ } applyTheme(choice); }

// ---------------------------------------------------------------------------
// password rules (shown live on sign-up, reset and change password)
// ---------------------------------------------------------------------------
function passwordCheck(pw, email = "", name = "") {
  const lower = pw.toLowerCase();
  const local = (email.split("@")[0] || "").toLowerCase();
  const nameParts = name.toLowerCase().split(/\s+/).filter((p) => p.length >= 3);
  const rules = [
    { ok: pw.length >= 10, label: "At least 10 characters" },
    { ok: pw.length <= 72, label: "No more than 72 characters" },
    { ok: !(local.length >= 3 && lower.includes(local)) && !nameParts.some((p) => lower.includes(p)), label: "Doesn't contain your name or email" },
    { ok: !/^(.)\1+$/.test(pw) && !/^(1234|password|qwerty)/i.test(pw), label: "Not an easy-to-guess pattern" },
  ];
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  let score = 0;
  if (pw.length >= 10) score = 1;
  if (pw.length >= 12 && variety >= 2) score = 2;
  if (pw.length >= 14 && variety >= 3) score = 3;
  if (pw.length >= 16 && variety >= 3) score = 4;
  if (!rules.every((r) => r.ok)) score = Math.min(score, 1);
  return { ok: rules.every((r) => r.ok), rules, score };
}

function passwordField(name = "password", label = "Password") {
  return `<label class="field">${label}<input name="${name}" type="password" autocomplete="new-password" required>
    <div class="strength" data-score="0"><span></span><span></span><span></span><span></span></div>
    <ul class="rules"></ul></label>`;
}

function bindPasswordRules(form, getEmail = () => "", getName = () => "", name = "password") {
  const input = form.querySelector(`input[name=${name}]`);
  const update = () => {
    const r = passwordCheck(input.value, getEmail(), getName());
    form.querySelector(".strength").dataset.score = input.value ? r.score : 0;
    form.querySelector(".rules").innerHTML = r.rules.map((x) => `<li class="${x.ok && input.value ? "met" : ""}">${x.label}</li>`).join("");
  };
  input.addEventListener("input", update);
  update();
  return () => passwordCheck(input.value, getEmail(), getName());
}

// ---------------------------------------------------------------------------
// login screens
// ---------------------------------------------------------------------------
let authMode = "signin";
let recovering = false;
const BRAND = `<div class="brand"><div class="logo">${ICON.logo}</div>FreedomDay</div>`;

function renderAuth() {
  const root = $("#root");
  const demo = api.demo ? `<div class="demo-banner" style="margin:0">Demo mode: any email and password works, and nothing is saved.</div>` : "";
  let body;
  if (recovering) {
    body = `<div><h2 style="margin:0 0 4px">Set a new password</h2><p class="muted small" style="margin:0">Other devices will be signed out.</p></div>
      <form class="form" id="f-reset">${passwordField()}
        <label class="field">Confirm password<input name="confirm" type="password" autocomplete="new-password" required></label>
        <div class="error hidden"></div><button class="btn block">Save new password</button></form>`;
  } else if (authMode === "forgot") {
    body = `<div><h2 style="margin:0 0 4px">Forgot password?</h2><p class="muted small" style="margin:0">We'll email you a link. It works once and expires in 1 hour.</p></div>
      <form class="form" id="f-forgot"><label class="field">Email<input name="email" type="email" autocomplete="email" required></label>
        <div class="error hidden"></div><div class="success hidden"></div><button class="btn block">Send reset link</button></form>
      <button class="linkish" data-mode="signin">Back to sign in</button>`;
  } else {
    const signup = authMode === "signup";
    body = `<div><h2 style="margin:0 0 4px">${signup ? "Create your account" : "Welcome back"}</h2>
        <p class="muted small" style="margin:0">${signup ? "Two minutes to set up. Free to start." : "Sign in to see today's number."}</p></div>
      <div class="tabs" role="tablist" style="display:grid;grid-template-columns:1fr 1fr"><button class="${signup ? "" : "active"}" data-mode="signin">Sign in</button><button class="${signup ? "active" : ""}" data-mode="signup">Create account</button></div>
      <form class="form" id="f-auth">
        ${signup ? `<label class="field">Your name<input name="name" autocomplete="name" required></label>` : ""}
        <label class="field">Email<input name="email" type="email" autocomplete="email" required></label>
        ${signup ? passwordField() : `<label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label>`}
        ${signup ? `<label class="field">Confirm password<input name="confirm" type="password" autocomplete="new-password" required></label>` : ""}
        <div class="error hidden"></div><div class="success hidden"></div>
        <button class="btn block">${signup ? "Create account" : "Sign in"}</button>
      </form>
      ${signup ? "" : `<button class="linkish" data-mode="forgot">Forgot password?</button>`}`;
  }
  const feature = (icon, color, title, text) => `<div class="feature">${tile(icon, color)}<div><b>${title}</b><div class="small text-2">${text}</div></div></div>`;
  root.innerHTML = `<div class="auth">
    <aside class="auth-art"><div class="stack" style="gap:6px">${BRAND}<span class="eyebrow">Earn today. Free tomorrow.</span></div>
      <div><h2>Know exactly what you need to earn <span class="grad-text">every day.</span></h2>
        <p>EMIs, card bills, school fees, holidays and SIPs, turned into one daily number, with AI that finds money you're wasting.</p></div>
      <div class="features">${feature(ICON.dues, "var(--c-1)", "Never miss a due date", "EMIs, credit cards and bills in one calendar")}
        ${feature(ICON.invest, "var(--c-5)", "Your Freedom Date", "See when your investments can pay for your life")}
        ${feature(ICON.ai, "var(--c-6)", "AI cost cutter", "Spots unused subscriptions, fees and interest")}</div>
    </aside>
    <div class="auth-main"><div class="panel"><div class="auth-mobile-brand stack" style="gap:6px">${BRAND}<span class="eyebrow">Earn today. Free tomorrow.</span></div>${demo}<div class="card glow stack" style="gap:18px;padding:22px">${body}</div>
      <p class="tiny muted" style="text-align:center;margin:0">${ICON.shield.replace("<svg", '<svg width="14" height="14" style="vertical-align:-2px"')} Your password is never stored by FreedomDay. Only a secure hash is kept by our sign-in service.</p></div></div></div>`;

  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { authMode = b.dataset.mode; renderAuth(); }));
  const show = (form, cls, msg) => { const el = $(`.${cls}`, form); el.textContent = msg; el.classList.remove("hidden"); };
  const hideMsgs = (form) => form.querySelectorAll(".error,.success").forEach((e) => e.classList.add("hidden"));

  const fAuth = $("#f-auth");
  if (fAuth) {
    const check = authMode === "signup" ? bindPasswordRules(fAuth, () => fAuth.email.value, () => fAuth.name.value) : null;
    fAuth.addEventListener("submit", async (e) => {
      e.preventDefault(); hideMsgs(fAuth);
      const btn = $("button", fAuth); btn.disabled = true;
      const { name, email, password, confirm } = Object.fromEntries(new FormData(fAuth).entries());
      try {
        if (authMode === "signup") {
          if (!check().ok) throw new Error("Please choose a stronger password (see the rules above).");
          if (password !== confirm) throw new Error("The two passwords don't match.");
          const r = await api.signUp({ name: name.trim(), email: email.trim(), password });
          if (r.needsConfirm) show(fAuth, "success", "Almost done! We sent a link to " + email + ". Open it to confirm your email, then sign in.");
        } else {
          await api.signIn(email.trim(), password);
        }
      } catch (ex) { show(fAuth, "error", ex.message); } finally { btn.disabled = false; }
    });
  }
  const fForgot = $("#f-forgot");
  fForgot?.addEventListener("submit", async (e) => {
    e.preventDefault(); hideMsgs(fForgot);
    try {
      await api.sendReset(fForgot.email.value.trim());
      show(fForgot, "success", "If that email has an account, a reset link is on its way.");
    } catch (ex) { show(fForgot, "error", ex.message); }
  });
  const fReset = $("#f-reset");
  if (fReset) {
    const check = bindPasswordRules(fReset, () => user?.email || "", () => user?.user_metadata?.full_name || "");
    fReset.addEventListener("submit", async (e) => {
      e.preventDefault(); hideMsgs(fReset);
      try {
        if (!check().ok) throw new Error("Please choose a stronger password.");
        if (fReset.password.value !== fReset.confirm.value) throw new Error("The two passwords don't match.");
        await api.changePassword(fReset.password.value);
        recovering = false;
        toast("Password updated");
        location.hash = "#/home";
        $("#root").innerHTML = "";
        render();
      } catch (ex) { show(fReset, "error", ex.message); }
    });
  }
}

// ---------------------------------------------------------------------------
// app shell
// ---------------------------------------------------------------------------
const TABS = [["home", "Home"], ["money", "Money"], ["dues", "Dues"], ["grow", "Goals"], ["ai", "Ask AI"]];
const route = () => (location.hash.replace(/^#\/?/, "").split("?")[0] || "home");
const initials = () => ((user?.user_metadata?.full_name || user?.email || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") || "?").toUpperCase();

async function render() {
  if (!user || recovering) return renderAuth();
  const r = route();
  const views = { home: viewHome, money: viewMoney, dues: viewDues, grow: viewGrow, ai: viewAi, settings: viewSettings };
  const view = views[r] || viewHome;
  const root = $("#root");
  if (!$(".app", root)) {
    root.innerHTML = `<div class="app">
      <aside class="sidebar" aria-label="Main">${BRAND}
        ${TABS.map(([k, l]) => `<a class="nav" href="#/${k}" data-tab="${k}">${ICON[k]}<span>${l}</span></a>`).join("")}
        <a class="nav" href="#/settings" data-tab="settings">${ICON.gear}<span>Settings</span></a>
        <div class="grow"></div><button class="btn add" id="side-add">${ICON.plus} Quick add</button></aside>
      <div class="content"><header class="topbar"><div class="who"><a class="avatar" href="#/settings" aria-label="Settings">${esc(initials())}</a>
        <div style="min-width:0"><h1 id="title"></h1><div class="sub" id="subtitle"></div></div></div>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${ICON.gear}</a></header>
      ${api.demo ? `<div class="demo-banner">Demo mode with sample numbers. Nothing is saved.</div>` : ""}
      <main id="view" aria-live="polite"></main></div></div>
      <button class="fab" id="fab" aria-label="Quick add expense or income">${ICON.plus}</button>
      <nav class="bottom-nav" aria-label="Main">${TABS.map(([k, l]) => `<a href="#/${k}" data-tab="${k}">${ICON[k]}<span>${l}</span></a>`).join("")}</nav>`;
    $("#fab").addEventListener("click", () => quickAdd());
    $("#side-add").addEventListener("click", () => quickAdd());
  }
  document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === r));
  $("#fab").classList.toggle("hidden", r === "ai" || r === "settings");
  const main = $("#view");
  main.innerHTML = skeleton();
  try {
    await view(main);
  } catch (ex) {
    console.error(ex);
    main.innerHTML = `<div class="card error">Something went wrong: ${esc(ex.message)}</div>`;
  }
}

const skeleton = () => `<div class="grid g-hero"><div class="skel" style="height:230px"></div><div class="skel" style="height:230px"></div></div>
  <div class="stats">${'<div class="skel" style="height:78px"></div>'.repeat(4)}</div><div class="skel" style="height:180px"></div>`;

function setTitle(t, sub = "") { $("#title").textContent = t; $("#subtitle").textContent = sub; document.title = `${t} · FreedomDay`; }

async function refreshCache() {
  [cache.categories, cache.accounts] = await Promise.all([api.categories(), api.accounts()]);
}

function quickAdd(kind = "expense") {
  sheet("Quick add", `<div class="tabs" style="display:grid;grid-template-columns:1fr 1fr;margin-bottom:16px"><button data-k="expense" class="${kind === "expense" ? "active" : ""}">Expense</button><button data-k="income" class="${kind === "income" ? "active" : ""}">Income</button></div><div id="qa"></div>`, (root, close) => {
    root.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { close(); quickAdd(b.dataset.k); }));
    $("#qa", root).innerHTML = formHtml([
      { name: "amount", label: "Amount", type: "money", required: true },
      { name: "category_id", label: "Category", type: "select", options: categoryOptions(kind), required: true },
      { name: "merchant", label: kind === "income" ? "From" : "Where / what", hint: kind === "income" ? "e.g. Salary, client name" : "e.g. DMart, petrol, school canteen" },
      [{ name: "account_id", label: "Account", type: "select", options: accountOptions((a) => a.kind !== "loan" && a.kind !== "investment"), required: true },
       { name: "txn_date", label: "Date", type: "date", value: todayIso(), required: true }],
    ], kind === "income" ? "Add income" : "Add expense");
    const form = $("form", root);
    form.amount.focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(form).entries());
      const amt = toPaise(v.amount);
      const err = $(".error", form);
      if (amt <= 0) { err.textContent = "Enter an amount more than zero."; err.classList.remove("hidden"); return; }
      try {
        await api.addTransaction({ account_id: v.account_id, txn_date: v.txn_date, amount_paise: kind === "income" ? amt : -amt,
          category_id: Number(v.category_id), merchant: v.merchant || null, source: "manual" });
        close(); toast(kind === "income" ? "Income added" : "Expense added"); render();
      } catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); }
    });
  });
}

function payDue(due) {
  const accs = accountOptions((a) => ["bank", "cash", "wallet"].includes(a.kind));
  sheet(`Pay ${due.name}`, `<div class="row" style="margin:-6px 0 14px"><span class="big tnum">${rupees(due.amount_paise)}</span>${statusChip(due)}</div>
    ${formHtml([{ name: "account", label: "Paid from", type: "select", options: accs, required: true }], "Mark as paid")}`, (root, close) => {
    $("form", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await api.payDue(due, e.target.account.value); close(); toast("Marked as paid"); render(); } catch (ex) {
        const err = $(".error", root); err.textContent = ex.message; err.classList.remove("hidden");
      }
    });
  });
}

// status = colour + icon + words (never colour alone)
function statusChip(d) {
  const n = daysFrom(d.due_date);
  if (d.status === "overdue" || n < 0) return `<span class="chip bad">${ICON.alert}${whenText(d.due_date)}</span>`;
  if (n <= 3) return `<span class="chip warn">${ICON.clock}${whenText(d.due_date)}</span>`;
  return `<span class="chip info">${ICON.clock}${whenText(d.due_date)}</span>`;
}
const payBtn = (d) => `<button class="btn small soft" data-pay='${esc(JSON.stringify(d))}'>Pay</button>`;
function dueEditBtn(d) {
  if (d.type === "card") return editBtn("statement", d.id, "Edit card bill");
  if (d.type === "emi") return editBtn("loan", d.id, "Edit loan");
  if (d.type === "bill" && d.bill_id) return editBtn("bill", d.bill_id, "Edit bill");
  return "";
}
function dueItem(d) {
  return `<div class="item">${tile(TYPE[d.type].icon, TYPE[d.type].color)}<div class="grow"><div class="title">${esc(d.name)}</div>
    <div class="meta">${statusChip(d)}<span>${fmtDate(d.due_date)}</span>${d.autopay ? "<span>· autopay</span>" : ""}</div></div>
    <div class="amt tnum">${rupees(d.amount_paise)}</div>${payBtn(d)}${dueEditBtn(d)}</div>`;
}
function dueCard(d) {
  const n = daysFrom(d.due_date);
  return `<div class="due-card ${n < 0 || d.status === "overdue" ? "late" : n <= 3 ? "soon" : ""}"><div class="row">${tile(TYPE[d.type].icon, TYPE[d.type].color)}${statusChip(d)}</div>
    <div><div class="title" style="font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</div><div class="tiny muted">Due ${fmtDate(d.due_date)}</div></div>
    <div class="row"><span class="mid tnum">${rupees(d.amount_paise)}</span><span class="btn-row" style="flex-wrap:nowrap">${payBtn(d)}${dueEditBtn(d)}</span></div></div>`;
}
function bindPay(root) { root.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", () => payDue(JSON.parse(b.dataset.pay)))); }

// ---------------------------------------------------------------------------
// Debt-free plan (Dues page card + Home summary)
// ---------------------------------------------------------------------------
const loanDebts = (loans) => loans.filter((l) => l.status === "active" && l.outstanding_paise > 0).map((l) => ({
  id: l.id, name: `${l.lender} · ${l.loan_type} loan`, balance: l.outstanding_paise, rate: (l.interest_rate_bps || 0) / 10000, payment: l.emi_paise }));
const monthYear = (n) => addMonths(n).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
const yrsMo = (n) => n == null ? "—" : n < 12 ? `${n} month${n === 1 ? "" : "s"}` : `${Math.floor(n / 12)} yr${n >= 24 ? "s" : ""}${n % 12 ? ` ${n % 12} mo` : ""}`;
// extra money per month for loans: the surplus, plus extra earning (which first covers any gap)
const debtExtraMonthly = (est, extraPerDayPaise) => Math.max(0, (est && est.income > 0 ? est.surplus : 0) + extraPerDayPaise * 365 / 12);

// Monthly-income steps for the forecast slider: ₹10k steps to ₹10 L, then ₹50k steps to ₹50 L
const INCOME_STEPS = [...Array.from({ length: 101 }, (_, i) => i * 10000), ...Array.from({ length: 80 }, (_, i) => 1050000 + i * 50000)];
const nearestStep = (steps, v) => steps.reduce((best, step, i) => (Math.abs(step - v) < Math.abs(steps[best] - v) ? i : best), 0);
const whenText2 = (m) => (m == null ? "Not reachable" : m === 0 ? "Now" : `${monthYear(m)} · ${yrsMo(m)}`);

function debtPlanCard(loans, est) {
  const debts = loanDebts(loans);
  const income0 = Math.max(0, Math.round((est?.income || 0) / 100));
  return `<section class="card glow" id="debt-plan"><div class="card-head"><h2>Forecast: debt-free and freedom</h2>
      ${debts.length ? `<div class="tabs" role="tablist"><button class="active" data-strategy="avalanche">Highest interest first</button><button data-strategy="snowball">Smallest loan first</button></div>` : ""}</div>
    <div class="grid g-2" style="align-items:start">
      <div class="stack" style="gap:10px">
        <div class="stack" style="gap:4px"><div class="row small" style="flex-wrap:wrap;row-gap:8px"><span class="text-2">My monthly income</span>
          <label class="wi-box">₹<input id="dp-income" type="number" inputmode="numeric" min="0" max="50000000" step="1000" value="${income0}" aria-label="Monthly income">/month</label></div>
          <input type="range" id="dp-range" min="0" max="${INCOME_STEPS.length - 1}" step="1" value="${nearestStep(INCOME_STEPS, income0)}" aria-label="Monthly income">
          <div class="wi-ticks tiny muted" aria-hidden="true">${[[0, "₹0"], [500000, "₹5L"], [1000000, "₹10L"], [3000000, "₹30L"], [5000000, "₹50L"]].map(([v, l]) =>
            `<span style="left:${(INCOME_STEPS.indexOf(v) / (INCOME_STEPS.length - 1)) * 100}%">${l}</span>`).join("")}</div>
          <div class="tiny muted">Today: ${income0 ? rupees(income0 * 100) + "/month (" + esc(est?.basis || "") + ")" : "no income recorded yet"} · costs incl. EMIs ${rupees(est?.costs || 0)}/month</div></div>
        <div class="split" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="stat"><span class="label">Debt-free by</span><span class="value" id="dp-date">—</span><span class="delta" id="dp-date-sub"></span></div>
          <div class="stat"><span class="label">Freedom by</span><span class="value" id="dp-free">—</span><span class="delta" id="dp-free-sub"></span></div>
        </div>
        <div class="small text-2" id="dp-note"></div></div>
      <div class="list" id="dp-list">${debts.length ? "" : `<div class="empty">${tile(ICON.check, "var(--good-text)")}No active loans. You're debt-free!</div>`}</div></div>
    <div style="margin-top:16px;overflow-x:auto"><table class="fc-table" aria-label="Forecast by monthly income"><thead><tr><th>Monthly income</th><th>Per day</th><th>Spare / month</th><th>Debt-free by</th><th>Freedom by</th></tr></thead><tbody id="dp-table"></tbody></table></div>
  </section>`;
}

function bindDebtPlan(main, loans, est, freedom) {
  const card = $("#debt-plan", main);
  if (!card || !est || !freedom) return;
  const debts = loanDebts(loans);
  let strategy = "avalanche";
  const income0 = Math.max(0, est.income || 0);
  const run = (income) => forecast({ freedom, debts, income, costs: est.costs, strategy });
  const base = debtPlan(debts, 0, strategy, { rollover: false });           // EMIs alone, nothing extra
  const draw = () => {
    const income = Math.max(0, Number($("#dp-income", card).value) || 0) * 100;
    const f = run(income), now = run(income0);
    $("#dp-date", card).textContent = !debts.length ? "Done" : f.debtMonths == null ? "Not yet" : f.debtMonths === 0 ? "Now" : monthYear(f.debtMonths);
    $("#dp-date-sub", card).innerHTML = !debts.length ? "no loans" : f.debtMonths == null ? "EMIs don't cover the interest"
      : income !== income0 && now.debtMonths != null && now.debtMonths !== f.debtMonths ? `<b class="${f.debtMonths < now.debtMonths ? "up" : "down"}">${yrsMo(Math.abs(now.debtMonths - f.debtMonths))} ${f.debtMonths < now.debtMonths ? "sooner" : "later"}</b> than today`
      : `in ${yrsMo(f.debtMonths)}`;
    $("#dp-free", card).textContent = f.freedomMonths == null ? "Not yet" : f.freedomMonths === 0 ? "Now" : monthYear(f.freedomMonths);
    $("#dp-free-sub", card).innerHTML = f.freedomMonths == null ? (f.spare + f.emiTotal <= 0 ? "income too low" : "add your living costs")
      : income !== income0 && now.freedomMonths != null && now.freedomMonths !== f.freedomMonths ? `<b class="${f.freedomMonths < now.freedomMonths ? "up" : "down"}">${yrsMo(Math.abs(now.freedomMonths - f.freedomMonths))} ${f.freedomMonths < now.freedomMonths ? "sooner" : "later"}</b> than today`
      : `in ${yrsMo(f.freedomMonths)}`;
    $("#dp-note", card).innerHTML = f.spare < 0
      ? `<span class="chip warn">${ICON.alert}Short ${rupees(-f.spare)}/month</span> At this income your payments (${rupees(est.costs)}) are more than you earn. ${debts.length ? "Loans close on EMIs alone; earn" : "Earn"} <b class="tnum">${rupees(-f.spare)}</b>/month more (<b class="tnum">${rupees(-f.spare * 12 / 365)}</b>/day) to ${debts.length ? "start paying them off faster" : "start investing"}.`
      : `Spare <b class="tnum up">${rupees(f.spare)}</b>/month goes to your loans${debts.length ? ` (${strategy === "snowball" ? "smallest first" : "highest interest first"}); when a loan closes its EMI moves to the next one. After the last loan, the spare money plus ${rupees(f.emiTotal)}/month of finished EMIs is invested` : " and investments"}.`;
    if (debts.length) {
      const maxM = Math.max(1, ...base.debts.map((d) => d.months || 0), ...f.plan.debts.map((d) => d.months || 0));
      $("#dp-list", card).innerHTML = f.plan.debts.slice().sort((a, b) => (a.months ?? 1e9) - (b.months ?? 1e9)).map((d, i) => {
        const b = base.debts.find((x) => x.id === d.id);
        return `<div class="item" style="display:grid;gap:8px"><div class="row">${tile(ICON.emi, "var(--c-6)")}<div class="grow" style="min-width:0"><div class="title">${i + 1}. ${esc(d.name)}</div>
            <div class="meta">${compact(d.balance)} left · ${(d.rate * 100).toFixed(2)}% · EMI ${rupees(d.payment)}</div></div>
            <div class="amt small" style="text-align:right">${d.months == null ? "—" : monthYear(d.months)}<div class="tiny muted">${b?.months != null && d.months != null && b.months > d.months ? `EMIs alone: ${monthYear(b.months)}` : yrsMo(d.months)}</div></div></div>
          <div class="bar" data-tip="${esc(d.name)}|closes ${d.months == null ? "never" : monthYear(d.months)}${b?.months ? ` · EMIs alone ${monthYear(b.months)}` : ""}"><span style="width:${d.months == null ? 100 : Math.max(2, (d.months / maxM) * 100)}%;background:var(--c-6)"></span></div></div>`;
      }).join("");
    }
    // scenario table: today, break-even, your target, and higher incomes
    const targetIncome = Math.round(est.targetMonthly || 0);
    const levels = [["Today", income0], ["Covers all payments", est.costs], ["Your target", targetIncome], ["Today + 25%", income0 * 1.25], ["Today + 50%", income0 * 1.5], ["Target + 25%", targetIncome * 1.25], ["Target × 2", targetIncome * 2]]
      .map(([l, v]) => [l, Math.ceil(v / 100000) * 100000]).filter(([, v]) => v > 0)
      .filter(([, v], i, a) => a.findIndex(([, w]) => w === v) === i).sort((a, b) => a[1] - b[1]);
    $("#dp-table", card).innerHTML = levels.map(([label, v]) => {
      const r = run(v), mine = Math.abs(v - income) < 50000;
      return `<tr class="${mine ? "mine" : ""}" tabindex="0" data-income="${v / 100}"><td><b class="tnum">${rupees(v)}</b><div class="tiny muted">${label}</div></td><td class="tnum">${rupees(v * 12 / 365)}</td>
        <td class="tnum ${r.spare >= 0 ? "up" : "down"}">${r.spare >= 0 ? "" : "−"}${rupees(Math.abs(r.spare))}</td>
        <td>${debts.length ? (r.debtMonths == null ? "—" : monthYear(r.debtMonths)) : "Done"}</td><td>${r.freedomMonths == null ? "—" : monthYear(r.freedomMonths)}</td></tr>`;
    }).join("");
    card.querySelectorAll("#dp-table tr").forEach((tr) => tr.addEventListener("click", () => { $("#dp-income", card).value = tr.dataset.income; sync(); }));
  };
  const range = $("#dp-range", card), box = $("#dp-income", card);
  const sync = () => { range.value = nearestStep(INCOME_STEPS, Number(box.value) || 0); draw(); };
  range.addEventListener("input", () => { box.value = INCOME_STEPS[Number(range.value)]; draw(); });
  box.addEventListener("input", sync);
  card.querySelectorAll("[data-strategy]").forEach((b) => b.addEventListener("click", () => {
    strategy = b.dataset.strategy; card.querySelectorAll("[data-strategy]").forEach((x) => x.classList.toggle("active", x === b)); draw();
  }));
  draw();
}

// What-if slider steps (₹ per day): fine at the low end, coarse at the top, up to ₹2 lakh
const WI_STEPS = [
  ...Array.from({ length: 11 }, (_, i) => i * 100),            // 0 – 1,000 by 100
  ...Array.from({ length: 8 }, (_, i) => 1500 + i * 500),      // 1,500 – 5,000 by 500
  ...Array.from({ length: 15 }, (_, i) => 6000 + i * 1000),    // 6,000 – 20,000 by 1,000
  ...Array.from({ length: 16 }, (_, i) => 25000 + i * 5000),   // 25,000 – 1,00,000 by 5,000
  ...Array.from({ length: 10 }, (_, i) => 110000 + i * 10000), // 1,10,000 – 2,00,000 by 10,000
];

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
async function viewHome(main) {
  const [h, week, homeBills, homeLoans, monthRows] = await Promise.all([api.home(), api.week().catch(() => []), api.bills().catch(() => []), api.loans().catch(() => []), api.months().catch(() => [])]);
  h.dues_7d = await api.withBillIds(h.dues_7d).catch(() => h.dues_7d);
  const name = (user.user_metadata?.full_name || "").split(" ")[0];
  const hr = new Date().getHours();
  setTitle(`${hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening"}${name ? ", " + name : ""}`, h.household?.name || "");
  const t = h.target, f0 = h.freedom;
  // No investments yet? Estimate the date from income minus costs instead of showing "—".
  const est = estimateFreedom(f0, t, monthlyAverages(monthRows));
  const homeDebts = loanDebts(homeLoans);
  const fc = est.income > 0 ? forecast({ freedom: f0, debts: homeDebts, income: est.income, costs: est.costs }) : null;
  const estimated = f0.years == null && fc?.freedomMonths != null;
  const f = estimated ? { ...f0, years: Math.round(fc.freedomMonths / 1.2) / 10, freedom_date: isoOf(addMonths(fc.freedomMonths)) } : f0;
  const freedomNote = f0.fi_number_paise <= 0 ? ""
    : estimated ? `<div class="small text-2" style="margin-top:10px">Estimated from your numbers: income <b class="tnum">${rupees(est.income)}</b>/month − payments <b class="tnum">${rupees(est.costs)}</b>/month = <b class="tnum ${fc.spare >= 0 ? "up" : "down"}">${fc.spare >= 0 ? "" : "−"}${rupees(Math.abs(fc.spare))}</b>/month spare <span class="muted">(${esc(est.basis)})</span>.
        ${homeDebts.length ? `Spare money first clears your loans (debt-free ${fc.debtMonths ? monthYear(fc.debtMonths) : "now"}), then it and the finished EMIs are invested.` : "It is invested each month."} <a class="linkish" href="#/dues">See forecast</a></div>`
    : f0.years == null ? (est.income <= 0
        ? `<div class="small text-2" style="margin-top:10px">Add your income in <a class="linkish" href="#/money">Money</a> and your investments in <a class="linkish" href="#/grow">Goals</a> to see your Freedom date.</div>`
        : (() => {
            const need = fc ? Math.max(0, -(fc.spare + fc.emiTotal)) : est.shortfall;   // after loans end, their EMIs are free too
            return `<div class="small" style="margin-top:10px"><span class="chip warn">${ICON.alert}Not reachable yet</span> Your payments <b class="tnum">${rupees(est.costs)}</b>/month are more than your income <b class="tnum">${rupees(est.income)}</b>/month <span class="muted">(${esc(est.basis)})</span>.
              Earn <b class="tnum">${rupees(need)}</b>/month more (<b class="tnum">${rupees(need * 12 / 365)}</b>/day) to start investing${homeDebts.length ? ` once your loans end, or <b class="tnum">${rupees(est.shortfall)}</b>/month more to also clear them faster` : ""}. <a class="linkish" href="#/dues">See forecast</a></div>`;
          })())
    : fc?.freedomMonths != null && fc.freedomMonths < Math.round(f0.years * 12) ? `<div class="small text-2" style="margin-top:10px">Using your spare money and finished EMIs too would bring it to <b>${monthYear(fc.freedomMonths)}</b>. <a class="linkish" href="#/dues">See forecast</a></div>` : "";
  const empty = !t || t.monthly_paise === 0;
  const weekPct = pct(h.earned_this_week_paise, t.weekly_paise);
  const duesTotal = h.dues_7d.reduce((s, d) => s + d.amount_paise, 0);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i);
    const k = isoOf(d), row = week.find((w) => String(w.day).slice(0, 10) === k);
    return { label: i === 6 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" }), tipLabel: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }),
      value: row ? Number(row.income_paise) : 0, today: i === 6 };
  });
  const b = t.breakdown_paise;
  const segs = ["fixed", "kids", "daily", "sinking", "invest"].map((k) => ({ label: BUCKET[k].label, value: b[k] || 0, color: BUCKET[k].color })).filter((s) => s.value > 0);
  const buffer = t.monthly_paise - Object.values({ f: b.fixed, k: b.kids, d: b.daily, s: b.sinking, i: b.invest }).reduce((s, v) => s + (v || 0), 0);

  const onboarding = empty ? `<section class="card glow"><div class="card-head"><h2>Let's find your number</h2><span class="chip gold">3 steps · 5 min</span></div>
      <p class="text-2 small" style="margin:0 0 14px">Add what you pay every month. FreedomDay turns it into how much you need to earn each day and week.</p>
      <div class="grid g-3">
        <a class="due-card" href="#/dues" style="text-decoration:none">${tile(ICON.emi, "var(--c-1)")}<b>1. EMIs, cards & bills</b><span class="tiny muted">Loans, credit cards, rent, school fees</span></a>
        <a class="due-card" href="#/settings" style="text-decoration:none">${tile(ICON.daily, "var(--c-3)")}<b>2. Daily spend</b><span class="tiny muted">Groceries, milk, fuel, medicine</span></a>
        <a class="due-card" href="#/grow" style="text-decoration:none">${tile(ICON.goal, "var(--c-5)")}<b>3. Goals & SIPs</b><span class="tiny muted">Kids, holidays, investments</span></a>
      </div></section>` : "";

  main.innerHTML = `${onboarding}
    <div class="grid g-hero">
      <section class="card glow" aria-label="Earning target">
        <div class="row" style="align-items:flex-start">
          <div class="stack" style="gap:6px"><span class="eyebrow">Earn today</span>
            <div class="hero-num" id="hero-day">${rupees(t.daily_paise)}</div>
            <div class="text-2 small"><b class="tnum" style="color:var(--text)">${rupees(t.weekly_paise)}</b> per week · ${rupees(t.working_day_paise)} per working day</div></div>
          ${ring(weekPct, { size: 112, stroke: 10, color: "var(--accent)", label: "Earned this week", center: `<b>${weekPct}%</b><span class="tiny muted">this week</span>` })}
        </div>
        <div style="margin-top:14px">${weekBars(days, t.daily_paise, { fmt: rupees })}</div>
        <div class="row small"><span class="text-2">Earned this week <b class="tnum" style="color:var(--text)">${rupees(h.earned_this_week_paise)}</b></span>
          <button class="linkish" id="why">See breakdown</button></div>
      </section>

      <section class="card" aria-label="Financial freedom">
        <div class="card-head"><h2>Financial freedom</h2><span class="btn-row" style="flex-wrap:nowrap">${estimated ? `<span class="chip gold">Estimated</span>` : ""}<span class="chip info">${ICON.clock}${yearsText(f.years)}</span></span></div>
        <div class="row" style="justify-content:flex-start;gap:18px">
          ${ring(f.pct, { size: 128, stroke: 12, color: "var(--text-2)", label: "Freedom progress", center: `<b>${f.pct}%</b><span class="tiny muted">funded</span>` })}
          <div class="stack" style="gap:4px"><span class="eyebrow">Freedom date</span>
            <div class="big">${f.freedom_date ? fmtDate(f.freedom_date, { month: "short", year: "numeric" }) : "—"}</div>
            <div class="small text-2 tnum">${compact(f.corpus_paise)} of ${compact(f.fi_number_paise)}</div></div>
        </div>${freedomNote}
        ${f.fi_number_paise > 0 ? `<div class="stack" style="margin-top:16px;gap:4px"><div class="row small" style="flex-wrap:wrap;row-gap:8px"><span class="text-2">If I earn and invest more each day</span><label class="wi-box">+₹<input id="wi-num" type="number" inputmode="numeric" min="0" max="1000000" step="100" value="0" aria-label="Extra rupees per day">/day</label></div>
          <input type="range" id="wi" min="0" max="${WI_STEPS.length - 1}" step="1" value="0" aria-label="Extra rupees per day">
          <div class="wi-ticks tiny muted" aria-hidden="true">${[[0, "₹0"], [1000, "₹1K"], [10000, "₹10K"], [50000, "₹50K"], [200000, "₹2L"]].map(([v, l]) =>
            `<span style="left:${(WI_STEPS.indexOf(v) / (WI_STEPS.length - 1)) * 100}%">${l}</span>`).join("")}</div>
          <div class="small text-2" id="wi-out">Move the slider to see your new freedom date.</div></div>` : `<p class="small muted">Add your monthly costs and investments to see your Freedom Date.</p>`}
      </section>
    </div>

    <div class="stats">
      <div class="stat"><span class="label">Needed per month</span><span class="value tnum">${rupees(t.monthly_paise)}</span><span class="delta">incl. ${t.buffer_pct}% buffer</span></div>
      <div class="stat"><span class="label">Earned this month</span><span class="value tnum">${rupees(h.earned_this_month_paise)}</span><span class="delta">${pct(h.earned_this_month_paise, t.monthly_paise)}% of target</span></div>
      <div class="stat"><span class="label">Spent this month</span><span class="value tnum">${rupees(h.spent_this_month_paise)}</span><span class="delta">excl. card payments</span></div>
      <div class="stat"><span class="label">Due in 7 days</span><span class="value tnum">${rupees(duesTotal)}</span><span class="delta">${h.dues_7d.length} payment${h.dues_7d.length === 1 ? "" : "s"}</span></div>
    </div>

    ${(() => {
      const debts = loanDebts(homeLoans);
      if (!debts.length) return "";
      const extra = Math.round(debtExtraMonthly(est, 0));
      const plan = debtPlan(debts, extra), base = debtPlan(debts, 0, "avalanche", { rollover: false });
      const sooner = plan.months != null && base.months != null ? base.months - plan.months : 0;
      return `<section class="card"><div class="row" style="flex-wrap:wrap">
        <div class="row" style="justify-content:flex-start;gap:14px">${tile(ICON.emi, "var(--c-6)")}<div><span class="eyebrow">Debt-free by</span>
          <div class="mid">${plan.months == null ? "Not yet" : monthYear(plan.months)}</div>
          <div class="small text-2">${plan.months == null ? "EMIs don't cover the interest" : sooner > 0 ? `${yrsMo(sooner)} sooner than EMIs alone, ${extra > 0 ? "using your surplus" : "by moving each closed loan's EMI to the next"}` : `${debts.length} loan${debts.length === 1 ? "" : "s"} · paying EMIs`}</div></div></div>
        <a class="btn small soft" href="#/dues">See debt plan</a></div></section>`;
    })()}
    <section class="card"><div class="card-head"><h2>Coming up this week</h2><a class="link" href="#/dues">All dues</a></div>
      ${h.dues_7d.length ? `<div class="hscroll">${h.dues_7d.map(dueCard).join("")}</div>` : `<div class="empty">${tile(ICON.check, "var(--good-text)")}Nothing due this week</div>`}</section>

    <div class="grid g-2">
      <section class="card"><div class="card-head"><h2>Where your target goes</h2><span class="tiny muted">per month</span></div>
        ${segs.length ? `<div class="donut-layout">${donut(segs, { size: 170, stroke: 20, fmt: rupees, center: `<span class="tiny muted">Total</span><b class="tnum" style="font-size:17px">${compact(t.monthly_paise)}</b>` })}
          <div>${legend(segs, rupees)}${buffer > 0 ? `<div class="tiny muted" style="margin-top:8px">+ ${rupees(buffer)} safety buffer (${t.buffer_pct}%)</div>` : ""}</div></div>`
          : `<div class="empty">${tile(ICON.fixed)}Add bills and EMIs to see the split</div>`}</section>
      <section class="card"><div class="card-head"><h2>AI tips</h2><a class="link" href="#/ai">Ask AI</a></div>
        <div class="list">${h.insights.length ? h.insights.map((i) => `<div class="item" style="align-items:flex-start">${tile(i.severity >= 3 ? ICON.alert : ICON.bulb, i.severity >= 3 ? "var(--warn)" : "var(--accent)")}
          <div class="grow"><div class="title" style="white-space:normal">${esc(i.title)}</div><div class="small text-2">${esc(i.body)}</div>
          <div class="btn-row" style="margin-top:8px">${i.saving_paise ? `<span class="chip good">Save ${rupees(i.saving_paise)}/mo</span>` : ""}
            <button class="btn small soft" data-ins="${i.id}" data-st="accepted">Done</button><button class="btn small ghost" data-ins="${i.id}" data-st="dismissed">Dismiss</button></div></div></div>`).join("")
          : `<div class="empty">${tile(ICON.ai, "var(--c-6)")}No tips yet. Open Ask AI and tap "Find savings".</div>`}</div></section>
    </div>`;

  countUp($("#hero-day", main), t.daily_paise, rupees);
  bindEdit(main, { bill: homeBills, loan: homeLoans, statement: h.dues_7d.filter((d) => d.type === "card") });
  bindPay(main);
  $("#why", main).addEventListener("click", () => {
    sheet("How your number is worked out", `<div class="list">${["fixed", "kids", "daily", "sinking", "invest"].map((k) => `<div class="item">${tile(ICON[k], BUCKET[k].color)}<div class="grow"><div class="title">${BUCKET[k].label}</div>
      ${k === "fixed" && b.emi ? `<div class="meta">includes EMIs ${rupees(b.emi)}</div>` : ""}</div><div class="amt tnum">${rupees(b[k])}</div></div>`).join("")}
      <div class="item">${tile(ICON.shield, "var(--muted)")}<div class="grow"><div class="title">Safety buffer ${t.buffer_pct}%</div></div><div class="amt tnum">${rupees(buffer)}</div></div>
      <div class="item"><div class="grow"><div class="title">Needed per month</div><div class="meta">× 12 ÷ 365 = per day · × 7 = per week</div></div><div class="amt tnum">${rupees(t.monthly_paise)}</div></div></div>`);
  });
  const wi = $("#wi", main), wiNum = $("#wi-num", main);
  const useSurplus = f0.years == null && est.income > 0;   // no investments yet: plan from income − costs
  const showWhatIf = (rupeesPerDay) => {
    const extra = Math.max(0, Math.round(rupeesPerDay)) * 100;
    const out = $("#wi-out", main);
    if (!extra) { out.innerHTML = "Move the slider or type an amount to see your new freedom date."; return; }
    // extra earning first covers any gap between costs and income; the rest is invested
    const investPerDay = useSurplus ? est.surplus * 12 / 365 + extra : extra;
    if (useSurplus && est.income > 0) {
      const g = forecast({ freedom: f0, debts: homeDebts, income: est.income + extra * 365 / 12, costs: est.costs });
      out.innerHTML = g.freedomMonths == null ? `Not enough yet: earn <b class="tnum">${rupees(-(g.spare + g.emiTotal) * 12 / 365)}</b>/day more to start investing after your loans end.`
        : `Earning <b class="tnum">${rupees(extra * 365 / 12)}</b>/month more: ${homeDebts.length ? `debt-free <b>${g.debtMonths ? monthYear(g.debtMonths) : "now"}</b>, ` : ""}freedom <b>${monthYear(g.freedomMonths)}</b>${f.years != null && g.freedomMonths < f.years * 12 ? ` · <b class="up">${yrsMo(Math.round(f.years * 12) - g.freedomMonths)} sooner</b>` : ""}`;
      return;
    }
    if (investPerDay <= 0) {
      out.innerHTML = `That covers part of your gap. Earn <b class="tnum">${rupees(-investPerDay)}</b>/day more to cover your costs and start investing.`;
      return;
    }
    const r = whatIf(f0, investPerDay);
    out.innerHTML = r ? `Investing <b class="tnum">${rupees(investPerDay * 365 / 12)}</b>/month: freedom in <b>${r.years} years</b> (${r.date.toLocaleDateString("en-IN", { month: "short", year: "numeric" })})${f.years != null && f.years > r.years ? ` · <b class="up">${Math.round((f.years - r.years) * 10) / 10} years sooner</b>` : ""}`
      : "Add investments to see this.";
  };
  wi?.addEventListener("input", () => { const v = WI_STEPS[Number(wi.value)]; wiNum.value = v; showWhatIf(v); });
  wiNum?.addEventListener("input", () => {
    const v = Math.min(Math.max(Number(wiNum.value) || 0, 0), 1000000);
    wi.value = WI_STEPS.reduce((best, step, i) => (Math.abs(step - v) < Math.abs(WI_STEPS[best] - v) ? i : best), 0);
    showWhatIf(v);
  });
  main.querySelectorAll("[data-ins]").forEach((el) => el.addEventListener("click", async () => { await api.setInsight(el.dataset.ins, el.dataset.st); render(); }));
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
async function viewMoney(main) {
  setTitle("Money", new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }));
  const [h, spend, txns] = await Promise.all([api.home(), api.monthSpend(), api.transactions()]);
  const byBucket = {};
  spend.forEach((s) => { const k = BUCKET[s.bucket] ? s.bucket : "discretionary"; byBucket[k] = (byBucket[k] || 0) + Number(s.spend_paise); });
  const segs = ["fixed", "kids", "daily", "sinking", "invest", "discretionary"].filter((k) => byBucket[k] > 0).map((k) => ({ label: BUCKET[k].label, value: byBucket[k], color: BUCKET[k].color }));
  const maxSpend = Math.max(1, ...spend.map((s) => s.spend_paise));
  const net = h.earned_this_month_paise - h.spent_this_month_paise;
  const catOf = (id) => cache.categories.find((c) => c.id === id);

  const txHtml = (list, lastDay = "") => {
    let out = "", day = lastDay;
    list.forEach((t) => {
      if (t.txn_date !== day) { day = t.txn_date; out += `<div class="day-head">${daysFrom(day) === 0 ? "Today" : daysFrom(day) === -1 ? "Yesterday" : fmtDate(day, { weekday: "short", day: "numeric", month: "short" })}</div>`; }
      const c = catOf(t.category_id), bk = BUCKET[c?.bucket] ? c.bucket : "discretionary";
      out += `<div class="item">${tile(ICON[bk] || ICON.wallet, BUCKET[bk].color)}<div class="grow"><div class="title">${esc(t.merchant || c?.name || "Transaction")}</div>
        <div class="meta">${esc(c?.name || "Uncategorised")}</div></div>
        <div class="amt tnum ${t.amount_paise > 0 ? "up" : ""}">${t.amount_paise > 0 ? "+" : "−"}${rupees(Math.abs(t.amount_paise))}</div>
        ${editBtn("txn", t.id, "Edit transaction")}</div>`;
    });
    return out;
  };

  main.innerHTML = `
    <div class="stats">
      <div class="stat"><span class="label">Earned</span><span class="value tnum up">${rupees(h.earned_this_month_paise)}</span><span class="delta">this month</span></div>
      <div class="stat"><span class="label">Spent</span><span class="value tnum">${rupees(h.spent_this_month_paise)}</span><span class="delta">this month</span></div>
      <div class="stat"><span class="label">Left over</span><span class="value tnum ${net >= 0 ? "up" : "down"}">${net >= 0 ? "" : "−"}${rupees(Math.abs(net))}</span><span class="delta">earned − spent</span></div>
      <div class="stat"><span class="label">Daily target</span><span class="value tnum">${rupees(h.target.daily_paise)}</span><span class="delta">to cover everything</span></div>
    </div>
    <div class="grid g-2">
      <section class="card"><div class="card-head"><h2>Spending this month</h2></div>
        ${segs.length ? `<div class="donut-layout">${donut(segs, { size: 170, stroke: 20, fmt: rupees, center: `<span class="tiny muted">Spent</span><b class="tnum" style="font-size:17px">${compact(h.spent_this_month_paise)}</b>` })}<div>${legend(segs, rupees)}</div></div>`
          : `<div class="empty">${tile(ICON.money)}No spending yet this month</div>`}</section>
      <section class="card"><div class="card-head"><h2>Top categories</h2></div>
        <div class="stack">${spend.length ? spend.slice(0, 6).map((s) => {
          const bk = BUCKET[s.bucket] ? s.bucket : "discretionary";
          return `<div class="stack" style="gap:6px"><div class="row small"><span>${esc(s.category)}</span><b class="tnum">${rupees(s.spend_paise)}</b></div>
            <div class="bar"><span style="width:${pct(s.spend_paise, maxSpend)}%;background:${BUCKET[bk].color}" data-tip="${esc(s.category)}|${esc(rupees(s.spend_paise))} · ${s.count} payment${s.count === 1 ? "" : "s"}"></span></div></div>`;
        }).join("") : `<div class="empty">Add expenses to see your top categories</div>`}</div></section>
    </div>
    <section class="card"><div class="card-head"><h2>Transactions</h2><div class="btn-row"><button class="btn small soft" id="add-inc">+ Income</button><button class="btn small" id="add-exp">+ Expense</button></div></div>
      <div class="list" id="tx">${txns.length ? txHtml(txns) : `<div class="empty">${tile(ICON.wallet)}No transactions yet. Tap + to add your first one.</div>`}</div>
      ${txns.length >= 30 ? `<button class="btn small ghost block" id="more" style="margin-top:10px">Load more</button>` : ""}</section>`;

  let last = txns[txns.length - 1];
  const loaded = [...txns];
  const bindDel = (root) => bindEdit(root, { txn: loaded });
  bindDel(main);
  $("#add-inc", main).addEventListener("click", () => quickAdd("income"));
  $("#add-exp", main).addEventListener("click", () => quickAdd("expense"));
  $("#more", main)?.addEventListener("click", async (e) => {
    const more = await api.transactions(last);
    if (more.length) { loaded.push(...more); const frag = document.createElement("div"); frag.innerHTML = txHtml(more, last.txn_date); bindDel(frag); $("#tx", main).append(...frag.children); last = more[more.length - 1]; }
    if (more.length < 30) e.target.remove();
  });
}

// ---------------------------------------------------------------------------
// Dues: bills, EMIs, credit cards
// ---------------------------------------------------------------------------
async function viewDues(main) {
  setTitle("Dues", "Bills, EMIs and card payments");
  const [rawDues, bills, loans, cards, duesHome, duesMonths] = await Promise.all([api.dues(30), api.bills(), api.loans(), api.cards(),
    api.home().catch(() => null), api.months().catch(() => [])]);
  const duesEst = duesHome ? { ...estimateFreedom(duesHome.freedom, duesHome.target, monthlyAverages(duesMonths)), targetMonthly: duesHome.target.monthly_paise } : null;
  const dues = await api.withBillIds(rawDues).catch(() => rawDues);
  const late = dues.filter((d) => daysFrom(d.due_date) < 0 || d.status === "overdue");
  const week = dues.filter((d) => !late.includes(d) && daysFrom(d.due_date) <= 7);
  const later = dues.filter((d) => !late.includes(d) && daysFrom(d.due_date) > 7);
  const sum = (l) => l.reduce((s, d) => s + d.amount_paise, 0);
  const group = (title, list) => list.length ? `<div class="day-head">${title} · ${rupees(sum(list))}</div>${list.map(dueItem).join("")}` : "";
  const freqLabel = { weekly: "Weekly", monthly: "Monthly", quarterly: "Every 3 months", half_yearly: "Every 6 months", yearly: "Yearly" };
  const outstanding = loans.reduce((s, l) => s + l.outstanding_paise, 0);

  main.innerHTML = `
    <div class="stats">
      <div class="stat"><span class="label">Overdue</span><span class="value tnum ${late.length ? "down" : ""}">${rupees(sum(late))}</span><span class="delta">${late.length} payment${late.length === 1 ? "" : "s"}</span></div>
      <div class="stat"><span class="label">This week</span><span class="value tnum">${rupees(sum(week))}</span><span class="delta">${week.length} payment${week.length === 1 ? "" : "s"}</span></div>
      <div class="stat"><span class="label">Next 30 days</span><span class="value tnum">${rupees(sum(dues))}</span><span class="delta">all dues</span></div>
      <div class="stat"><span class="label">Loans left</span><span class="value tnum">${compact(outstanding)}</span><span class="delta">${loans.length} active loan${loans.length === 1 ? "" : "s"}</span></div>
    </div>
    ${debtPlanCard(loans, duesEst)}
    <section class="card"><div class="card-head"><h2>Upcoming payments</h2>
      <div class="btn-row"><button class="btn small" id="add-bill">+ Bill</button><button class="btn small ghost" id="add-loan">+ Loan / EMI</button>
      <button class="btn small ghost" id="add-card">+ Card</button>${cards.length ? `<button class="btn small soft" id="add-stmt">+ Card bill</button>` : ""}</div></div>
      <div class="list">${dues.length ? group("Overdue", late) + group("This week", week) + group("Later this month", later)
        : `<div class="empty">${tile(ICON.check, "var(--good-text)")}Nothing due in the next 30 days</div>`}</div></section>
    <div class="grid g-3">
      <section class="card"><div class="card-head"><h2>Loans / EMIs</h2></div><div class="list">${loans.length ? loans.map((l) => {
        const paid = pct(l.principal_paise - l.outstanding_paise, l.principal_paise);
        return `<div class="item" style="display:grid;gap:8px"><div class="row">${tile(ICON.emi, "var(--c-6)")}<div class="grow" style="min-width:0"><div class="title">${esc(l.lender)}</div>
          <div class="meta">${esc(l.loan_type)} · ${(l.interest_rate_bps / 100).toFixed(2)}% · day ${l.emi_day}</div></div><div class="amt tnum">${rupees(l.emi_paise)}</div>${editBtn("loan", l.id, "Edit loan")}</div>
          <div class="bar"><span style="width:${paid}%;background:var(--c-6)" data-tip="${esc(l.lender)} loan|${paid}% repaid · ${esc(compact(l.outstanding_paise))} left"></span></div>
          <div class="row tiny muted"><span>${paid}% repaid</span><span class="tnum">${compact(l.outstanding_paise)} left</span></div></div>`;
      }).join("") : `<div class="empty">No loans added</div>`}</div></section>
      <section class="card"><div class="card-head"><h2>Credit cards</h2></div><div class="list">${cards.length ? cards.map((c) => `<div class="item">${tile(ICON.card, "var(--c-2)")}<div class="grow"><div class="title">${esc(c.issuer)} ••${esc(c.last4)}</div>
        <div class="meta">Statement day ${c.statement_day} · due day ${c.due_day}</div></div><div class="amt tnum small">${compact(c.credit_limit_paise)}<div class="tiny muted">limit</div></div>${editBtn("card", c.id, "Edit card")}</div>`).join("") : `<div class="empty">No cards added</div>`}</div></section>
      <section class="card"><div class="card-head"><h2>Regular bills</h2></div><div class="list">${bills.length ? bills.map((b) => `<div class="item">${tile(ICON.bill, "var(--c-1)")}<div class="grow"><div class="title">${esc(b.name)}</div>
        <div class="meta">${freqLabel[b.frequency]}${b.autopay ? " · autopay" : ""}</div></div><div class="amt tnum">${rupees(b.amount_paise)}</div>${editBtn("bill", b.id, "Edit bill")}</div>`).join("") : `<div class="empty">No bills added</div>`}</div></section>
    </div>`;
  bindPay(main);
  bindEdit(main, { loan: loans, card: cards, bill: bills, statement: dues.filter((d) => d.type === "card") });
  bindDebtPlan(main, loans, duesEst, duesHome?.freedom);

  const nonIncome = cache.categories.filter((c) => !["income", "transfer"].includes(c.bucket)).map((c) => [c.id, `${c.name} (${BUCKET[c.bucket]?.label || c.bucket})`]);
  $("#add-bill", main).addEventListener("click", () => formSheet("Add a regular bill", [
    { name: "name", label: "Name", required: true, hint: "e.g. Electricity, School fees – Aarav, Netflix, Holiday fund" },
    [{ name: "amount", label: "Amount", type: "money", required: true },
     { name: "frequency", label: "How often", type: "select", value: "monthly", options: Object.entries(freqLabel) }],
    { name: "category_id", label: "Category", type: "select", options: nonIncome, required: true, hint: "Decides where it counts in your earning target" },
    [{ name: "next_due_date", label: "Next due date", type: "date", required: true, value: todayIso() },
     { name: "autopay", label: "Autopay?", type: "select", options: [["false", "No"], ["true", "Yes"]] }],
  ], "Add bill", (v) => api.addBill({ name: v.name, amount_paise: toPaise(v.amount), frequency: v.frequency, category_id: Number(v.category_id),
    next_due_date: v.next_due_date, due_day: new Date(v.next_due_date).getDate(), autopay: v.autopay === "true" })));

  $("#add-loan", main).addEventListener("click", () => formSheet("Add a loan / EMI", [
    [{ name: "loan_type", label: "Type", type: "select", options: [["home", "Home"], ["car", "Car"], ["personal", "Personal"], ["education", "Education"], ["gold", "Gold"], ["business", "Business"], ["other", "Other"]] },
     { name: "lender", label: "Bank / lender", required: true }],
    [{ name: "emi", label: "EMI amount", type: "money", required: true },
     { name: "emi_day", label: "EMI day of month", type: "number", min: 1, max: 31, required: true }],
    [{ name: "principal", label: "Original loan", type: "money", required: true },
     { name: "outstanding", label: "Still to pay", type: "money", hint: "Empty if new" }],
    [{ name: "rate", label: "Interest % / year", type: "number", step: "0.01", required: true },
     { name: "tenure", label: "Tenure (months)", type: "number", min: 1, required: true }],
    { name: "start_date", label: "Loan start date", type: "date", required: true },
  ], "Add loan", (v) => api.addLoan({ loan_type: v.loan_type, lender: v.lender, emi_paise: toPaise(v.emi), emi_day: Number(v.emi_day),
    principal_paise: toPaise(v.principal), outstanding_paise: v.outstanding ? toPaise(v.outstanding) : toPaise(v.principal),
    interest_rate_bps: Math.round(Number(v.rate) * 100), tenure_months: Number(v.tenure), start_date: v.start_date })));

  $("#add-card", main).addEventListener("click", () => formSheet("Add a credit card", [
    [{ name: "issuer", label: "Bank", required: true, hint: "e.g. HDFC, SBI" },
     { name: "last4", label: "Last 4 digits", required: true, hint: "Never the full number" }],
    { name: "limit", label: "Credit limit", type: "money", required: true },
    [{ name: "statement_day", label: "Statement day", type: "number", min: 1, max: 31, required: true },
     { name: "due_day", label: "Due day", type: "number", min: 1, max: 31, required: true }],
  ], "Add card", (v) => {
    if (!/^\d{4}$/.test(v.last4)) throw new Error("Enter exactly the last 4 digits.");
    return api.addCard({ issuer: v.issuer, last4: v.last4, credit_limit_paise: toPaise(v.limit), statement_day: Number(v.statement_day), due_day: Number(v.due_day) });
  }));

  $("#add-stmt", main)?.addEventListener("click", () => formSheet("Add a card bill", [
    { name: "card_id", label: "Card", type: "select", options: cards.map((c) => [c.id, `${c.issuer} ••${c.last4}`]) },
    [{ name: "total", label: "Total due", type: "money", required: true },
     { name: "min", label: "Minimum due", type: "money", required: true }],
    [{ name: "statement_date", label: "Statement date", type: "date", required: true, value: todayIso() },
     { name: "due_date", label: "Pay by", type: "date", required: true }],
  ], "Add card bill", (v) => api.addStatement({ card_id: v.card_id, total_due_paise: toPaise(v.total), min_due_paise: toPaise(v.min), statement_date: v.statement_date, due_date: v.due_date })));
}

// ---------------------------------------------------------------------------
// Goals & investments
// ---------------------------------------------------------------------------
let growTab = "goals";
const ASSET = {
  equity_mf: ["Equity funds", "var(--c-1)"], stock: ["Stocks", "var(--c-1)"], debt_mf: ["Debt funds", "var(--c-3)"], fd: ["FD / RD", "var(--c-3)"], rd: ["FD / RD", "var(--c-3)"],
  ppf: ["PPF / EPF / NPS", "var(--c-2)"], epf: ["PPF / EPF / NPS", "var(--c-2)"], nps: ["PPF / EPF / NPS", "var(--c-2)"], gold: ["Gold", "var(--c-4)"],
  real_estate: ["Real estate", "var(--c-5)"], crypto: ["Other", "var(--c-6)"], other: ["Other", "var(--c-6)"],
};
async function viewGrow(main) {
  setTitle("Goals & investments", "Kids' school, holidays, freedom");
  const [goals, holdings] = await Promise.all([api.goals(), api.holdings()]);
  const kindIcon = { financial_freedom: ICON.invest, emergency: ICON.shield, education: ICON.kids, holiday: ICON.sinking, festival: ICON.bulb, purchase: ICON.discretionary, debt_free: ICON.check, other: ICON.goal };
  const kindColor = { financial_freedom: "var(--c-6)", emergency: "var(--c-3)", education: "var(--c-2)", holiday: "var(--c-4)", festival: "var(--c-5)", purchase: "var(--c-1)", debt_free: "var(--c-3)", other: "var(--c-1)" };
  const tabs = `<div class="tabs"><button data-t="goals" class="${growTab === "goals" ? "active" : ""}">Goals</button><button data-t="invest" class="${growTab === "invest" ? "active" : ""}">Investments</button></div>`;
  let body;
  if (growTab === "goals") {
    const saved = goals.reduce((s, g) => s + g.saved_paise, 0), target = goals.reduce((s, g) => s + g.target_paise, 0);
    const monthly = goals.filter((g) => g.status === "active" && g.target_date).reduce((s, g) => s + Math.max(g.target_paise - g.saved_paise, 0) / monthsUntil(g.target_date), 0);
    body = `<div class="stats">
        <div class="stat"><span class="label">Saved for goals</span><span class="value tnum">${compact(saved)}</span><span class="delta">of ${compact(target)}</span></div>
        <div class="stat"><span class="label">Save per month</span><span class="value tnum">${rupees(monthly)}</span><span class="delta">to stay on track</span></div>
        <div class="stat"><span class="label">Save per day</span><span class="value tnum">${rupees(monthly * 12 / 365)}</span><span class="delta">for all goals</span></div>
        <div class="stat"><span class="label">Goals</span><span class="value tnum">${goals.length}</span><span class="delta">${goals.filter((g) => g.status === "achieved").length} reached</span></div></div>
      <div class="row"><h2 style="margin:0;font-size:16px">Your goals</h2><button class="btn small" id="add-goal">+ New goal</button></div>
      <div class="grid g-2">${goals.length ? goals.map((g) => {
        const left = Math.max(g.target_paise - g.saved_paise, 0);
        const perMonth = g.target_date ? left / monthsUntil(g.target_date) : 0;
        const p = pct(g.saved_paise, g.target_paise);
        return `<section class="card"><div class="row" style="justify-content:flex-start;gap:16px">
          ${ring(p, { size: 92, stroke: 9, color: kindColor[g.kind] || "var(--c-1)", label: g.name, center: `<b style="font-size:18px">${p}%</b>` })}
          <div class="stack grow" style="gap:4px;min-width:0;flex:1"><div class="row"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.name)}</b><span class="btn-row" style="flex-wrap:nowrap">${g.status === "achieved" ? `<span class="chip good">${ICON.check}Reached</span>` : ""}${editBtn("goal", g.id, "Edit goal")}</span></div>
            <div class="small text-2 tnum">${rupees(g.saved_paise)} of ${rupees(g.target_paise)}</div>
            ${g.target_date ? `<div class="tiny muted">by ${fmtDate(g.target_date, { month: "short", year: "numeric" })}</div>` : ""}
            ${left > 0 && g.target_date ? `<div class="small">Save <b class="tnum">${rupees(perMonth)}</b>/month · ${rupees(perMonth * 12 / 365)}/day</div>` : ""}</div></div>
          ${g.status !== "achieved" ? `<button class="btn small soft block" style="margin-top:12px" data-add="${g.id}">+ Add money</button>` : ""}</section>`;
      }).join("") : `<div class="card empty span-2">${tile(ICON.goal, "var(--c-5)")}No goals yet. Add your kids' education, a holiday or an emergency fund.</div>`}</div>`;
  } else {
    const cur = holdings.reduce((s, h) => s + h.current_paise, 0), inv = holdings.reduce((s, h) => s + h.invested_paise, 0);
    const sip = holdings.reduce((s, h) => s + (h.sip_paise || 0), 0);
    const gain = cur - inv;
    const groups = {};
    holdings.forEach((h) => { const [label, color] = ASSET[h.asset_class] || ASSET.other; groups[label] ??= { label, color, value: 0 }; groups[label].value += h.current_paise; });
    const segs = Object.values(groups).filter((g) => g.value > 0).sort((a, b) => b.value - a.value);
    body = `<div class="stats">
        <div class="stat"><span class="label">Value today</span><span class="value tnum">${compact(cur)}</span><span class="delta">${holdings.length} investment${holdings.length === 1 ? "" : "s"}</span></div>
        <div class="stat"><span class="label">Invested</span><span class="value tnum">${compact(inv)}</span><span class="delta">your money in</span></div>
        <div class="stat"><span class="label">Gain</span><span class="value tnum ${gain >= 0 ? "up" : "down"}">${gain >= 0 ? "+" : "−"}${compact(Math.abs(gain))}</span><span class="delta">${inv ? Math.round((gain / inv) * 1000) / 10 : 0}% overall</span></div>
        <div class="stat"><span class="label">SIPs</span><span class="value tnum">${rupees(sip)}</span><span class="delta">per month</span></div></div>
      ${segs.length ? `<section class="card"><div class="card-head"><h2>Allocation</h2><span class="tiny muted">by value today</span></div>${allocBar(segs, compact)}
        <div style="margin-top:14px">${legend(segs, compact)}</div></section>` : ""}
      <section class="card"><div class="card-head"><h2>Holdings</h2><button class="btn small" id="add-hold">+ Investment</button></div>
        <div class="list">${holdings.length ? holdings.map((h) => {
          const [label, color] = ASSET[h.asset_class] || ASSET.other;
          const g = h.current_paise - h.invested_paise;
          return `<div class="item">${tile(ICON.invest, color)}<div class="grow"><div class="title">${esc(h.name)}</div>
            <div class="meta">${esc(label)}${h.sip_paise ? ` · SIP ${rupees(h.sip_paise)}` : ""}${h.goal_id ? ` · for ${esc(goals.find((x) => x.id === h.goal_id)?.name || "a goal")}` : ""}</div></div>
            <div class="amt tnum">${compact(h.current_paise)}<div class="tiny ${g >= 0 ? "up" : "down"}">${g >= 0 ? "+" : "−"}${compact(Math.abs(g))}</div></div>
            ${editBtn("holding", h.id, "Edit investment")}</div>`;
        }).join("") : `<div class="empty">${tile(ICON.invest, "var(--c-5)")}Add your mutual funds, PPF, FD, gold and more</div>`}</div>
        <p class="tiny muted" style="margin:12px 0 0">Investments not linked to a goal count towards financial freedom. Real estate is not counted.</p></section>`;
  }
  main.innerHTML = tabs + body;
  main.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { growTab = b.dataset.t; render(); }));

  $("#add-goal", main)?.addEventListener("click", () => formSheet("New goal", [
    { name: "kind", label: "Type", type: "select", options: [["education", "Kids' education"], ["holiday", "Holiday"], ["emergency", "Emergency fund"], ["festival", "Festival / wedding"], ["purchase", "Big purchase"], ["debt_free", "Become debt-free"], ["financial_freedom", "Financial freedom"], ["other", "Other"]] },
    { name: "name", label: "Name", required: true, hint: "e.g. Goa trip May 2027, Aarav college 2036" },
    [{ name: "target", label: "Amount needed", type: "money", required: true },
     { name: "saved", label: "Already saved", type: "money" }],
    { name: "target_date", label: "Needed by", type: "date", required: true },
  ], "Add goal", (v) => api.addGoal({ kind: v.kind, name: v.name, target_paise: toPaise(v.target), target_date: v.target_date, saved_paise: toPaise(v.saved || 0) })));

  main.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => formSheet("Add money to goal", [
    { name: "amount", label: "Amount", type: "money", required: true },
  ], "Add", (v) => api.contribute(b.dataset.add, toPaise(v.amount)))));

  $("#add-hold", main)?.addEventListener("click", () => formSheet("Add an investment", [
    { name: "asset_class", label: "Type", type: "select", options: [["equity_mf", "Equity mutual fund"], ["debt_mf", "Debt mutual fund"], ["stock", "Stocks"], ["fd", "Fixed deposit"], ["rd", "Recurring deposit"], ["ppf", "PPF"], ["epf", "EPF"], ["nps", "NPS"], ["gold", "Gold"], ["real_estate", "Real estate"], ["other", "Other"]] },
    { name: "name", label: "Name", required: true },
    [{ name: "invested", label: "Amount invested", type: "money", required: true },
     { name: "current", label: "Value today", type: "money", required: true }],
    { name: "sip", label: "Monthly SIP (if any)", type: "money" },
    { name: "goal_id", label: "For a goal?", type: "select", options: [["", "No, for financial freedom"], ...goals.filter((g) => g.kind !== "financial_freedom").map((g) => [g.id, g.name])] },
  ], "Add investment", (v) => api.addHolding({ asset_class: v.asset_class, name: v.name, invested_paise: toPaise(v.invested), current_paise: toPaise(v.current),
    sip_paise: toPaise(v.sip || 0), goal_id: v.goal_id || null })));

  bindEdit(main, { goal: goals, holding: holdings }, goals);
}

// ---------------------------------------------------------------------------
// Ask AI
// ---------------------------------------------------------------------------
const chatHistory = [];
async function viewAi(main) {
  setTitle("Ask AI", "Your personal finance assistant");
  const profile = await api.profile();
  if (!profile?.ai_consent) {
    main.innerHTML = `<section class="card glow stack" style="max-width:640px">${tile(ICON.ai, "var(--c-6)")}<h2 style="margin:0">Switch on AI help?</h2>
      <p class="text-2" style="margin:0">The assistant reads your totals (targets, dues, spending by category) to answer questions and find savings.
      It never sees your password or full account numbers. Advice is educational, not licensed investment advice.</p>
      <div><button class="btn" id="consent">${ICON.ai} Yes, switch on AI help</button></div></section>`;
    $("#consent", main).addEventListener("click", async () => { await api.updateProfile({ ai_consent: true }); render(); });
    return;
  }
  const aiMsg = (text, cls = "") => `<div class="msg ai"><div class="ai-dot">${ICON.ai}</div><div class="bubble ${cls}">${text}</div></div>`;
  main.innerHTML = `<div class="grid g-hero" style="align-items:start">
    <section class="card stack" style="gap:14px"><div class="card-head" style="margin:0"><h2>Chat</h2><span class="chip info">${ICON.shield}Private to you</span></div>
      <div class="chat" id="chat">${chatHistory.length ? chatHistory.map((m) => m.role === "user" ? `<div class="msg me"><div class="bubble">${esc(m.content)}</div></div>` : aiMsg(esc(m.content))).join("")
        : aiMsg("Hi! Ask me anything about your money: your daily target, dues, savings or how to reach freedom sooner.")}</div>
      ${chatHistory.length ? "" : `<div class="suggest">${["How much should I earn per day?", "Can I afford a ₹1.2 lakh Goa trip in May?", "Which loan should I prepay first?", "How do I reach freedom sooner?"].map((q) => `<button>${esc(q)}</button>`).join("")}</div>`}
      <form class="chat-input" id="ask"><input name="q" placeholder="Ask about your money…" autocomplete="off" aria-label="Your question"><button class="btn small">Ask</button></form></section>
    <section class="card glow stack"><div class="card-head" style="margin:0"><h2>Find ways to save</h2>${tile(ICON.bulb, "var(--gold)")}</div>
      <p class="small text-2" style="margin:0">Checks subscriptions, card interest, late fees and overspending.</p>
      <button class="btn" id="savings">${ICON.ai} Find savings</button><div id="ins"></div></section></div>`;
  const chat = $("#chat", main);
  const ask = async (q) => {
    if (!q.trim()) return;
    $(".suggest", main)?.remove();
    chat.insertAdjacentHTML("beforeend", `<div class="msg me"><div class="bubble">${esc(q)}</div></div>${aiMsg('<span class="typing"><span></span><span></span><span></span></span>')}`);
    const pending = chat.lastElementChild;
    try {
      const answer = await api.ask(q, chatHistory.slice(-8));
      chatHistory.push({ role: "user", content: q }, { role: "assistant", content: answer });
      pending.outerHTML = aiMsg(esc(answer));
    } catch (ex) { pending.outerHTML = aiMsg(esc(ex.message), "error"); }
  };
  main.querySelectorAll(".suggest button").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));
  $("#ask", main).addEventListener("submit", (e) => { e.preventDefault(); const q = e.target.q.value; e.target.q.value = ""; ask(q); });
  $("#savings", main).addEventListener("click", async (e) => {
    const btn = e.currentTarget; btn.disabled = true; $("#ins", main).innerHTML = `<div class="empty"><span class="typing"><span></span><span></span><span></span></span><div>Looking through your spending…</div></div>`;
    try {
      const list = await api.findSavings();
      const total = list.reduce((s, i) => s + (i.saving_paise || 0), 0);
      $("#ins", main).innerHTML = list.length ? `${total ? `<div class="stat" style="margin-bottom:6px"><span class="label">You could save</span><span class="value up tnum">${rupees(total)}/month</span></div>` : ""}
        <div class="list">${list.map((i) => `<div class="item" style="align-items:flex-start">${tile(i.severity >= 3 ? ICON.alert : ICON.bulb, i.severity >= 3 ? "var(--warn)" : "var(--accent)")}<div class="grow">
        <div class="title" style="white-space:normal">${esc(i.title)}</div><div class="small text-2">${esc(i.body)}</div>
        ${i.saving_paise ? `<span class="chip good" style="margin-top:6px">Save ${rupees(i.saving_paise)}/mo</span>` : ""}</div></div>`).join("")}</div>` : `<div class="empty">Nothing to cut right now. Nice work!</div>`;
    } catch (ex) { $("#ins", main).innerHTML = `<div class="error">${esc(ex.message)}</div>`; } finally { btn.disabled = false; }
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function viewSettings(main) {
  setTitle("Settings", user.email || "");
  const [profile, hh, events] = await Promise.all([api.profile(), api.household(), api.loginEvents().catch(() => [])]);
  const st = hh.settings || {};
  const evLabel = { login_ok: "Signed in", login_failed: "Wrong password", locked: "Account locked", unlocked: "Unlocked", password_reset: "Password reset",
    password_changed: "Password changed", mfa_enabled: "2FA on", mfa_disabled: "2FA off", new_device: "New device", logout_all: "Signed out everywhere" };
  const device = (ua) => /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iPhone / iPad" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : "Browser";
  const theme = getTheme();

  main.innerHTML = `<div class="grid g-2" style="align-items:start">
    <section class="card"><div class="card-head"><h2>Your numbers</h2></div><form class="form" id="f-set">
      <label class="field">Daily needs per day<input name="daily" inputmode="decimal" value="${(st.daily_needs_per_day_paise || 0) / 100 || ""}" placeholder="₹ e.g. 550">
        <span class="hint">Groceries, milk, fuel, medicine. Leave empty to use your last 3 months' average.</span></label>
      <div class="split"><label class="field">Safety buffer %<input name="buffer" type="number" min="0" max="50" value="${st.buffer_pct ?? 5}"></label>
        <label class="field">Working days / month<input name="wd" type="number" min="1" max="31" value="${st.working_days_per_month ?? 26}"></label></div>
      <div class="split"><label class="field">Return after inflation %<input name="rr" type="number" step="0.5" min="0" max="15" value="${st.real_return_pct ?? 5}"></label>
        <label class="field">Freedom multiple<input name="swr" type="number" min="15" max="50" value="${st.swr_multiple ?? 25}"><span class="hint">25 = the 4% rule</span></label></div>
      <button class="btn">Save</button></form></section>

    <div class="stack" style="gap:16px">
      <section class="card"><div class="card-head"><h2>Appearance</h2></div>
        <div class="tabs" style="display:grid;grid-template-columns:repeat(3,1fr)">${[["dark", "Dark"], ["light", "Light"], ["system", "Same as phone"]].map(([k, l]) => `<button data-theme-set="${k}" class="${theme === k ? "active" : ""}">${l}</button>`).join("")}</div></section>
      <section class="card"><div class="card-head"><h2>Profile</h2><span class="chip gold">${esc((hh.plan_code || "free").replace(/^./, (c) => c.toUpperCase()))} plan</span></div><form class="form" id="f-prof">
        <label class="field">Name<input name="full_name" value="${esc(profile?.full_name || "")}"></label>
        <label class="check"><input type="checkbox" name="ai" ${profile?.ai_consent ? "checked" : ""}> Allow AI help to read my totals</label>
        <button class="btn ghost">Save profile</button></form></section>
    </div>

    <section class="card"><div class="card-head"><h2>Accounts</h2><button class="btn small soft" id="add-acc">+ Account</button></div><div class="list">${cache.accounts.map((a) => `<div class="item">${tile({ credit_card: ICON.card, loan: ICON.emi, investment: ICON.invest }[a.kind] || ICON.wallet, "var(--c-1)")}
      <div class="grow"><div class="title">${esc(a.name)}${a.last4 ? ` ••${esc(a.last4)}` : ""}</div><div class="meta">${esc(a.kind.replace("_", " "))}</div></div>${a.kind === "credit_card" ? "" : editBtn("account", a.id, "Edit account")}</div>`).join("")}</div></section>

    <section class="card"><div class="card-head"><h2>Security</h2>${tile(ICON.shield, "var(--good-text)")}</div>
      <div class="btn-row"><button class="btn ghost small" id="chg">Change password</button><button class="btn ghost small" id="out">Sign out</button><button class="btn danger small" id="out-all">Sign out everywhere</button></div>
      <div class="day-head" style="margin-top:6px">Recent activity</div><div class="list">${events.length ? events.map((e) => `<div class="item"><div class="grow"><div class="title">${evLabel[e.event] || e.event}</div>
        <div class="meta">${device(e.device || "")} · ${new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div></div>${e.event === "login_failed" || e.event === "locked" ? `<span class="chip bad">${ICON.alert}Check</span>` : ""}</div>`).join("") : `<div class="empty">No activity yet</div>`}</div></section>
  </div>`;

  bindEdit(main, { account: cache.accounts });
  main.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => { setTheme(b.dataset.themeSet); render(); }));
  $("#f-set", main).addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target).entries());
    await api.updateSettings({ ...st, daily_needs_per_day_paise: v.daily ? toPaise(v.daily) : 0, buffer_pct: Number(v.buffer), working_days_per_month: Number(v.wd),
      real_return_pct: Number(v.rr), swr_multiple: Number(v.swr) });
    toast("Saved. Your targets are updated.");
  });
  $("#f-prof", main).addEventListener("submit", async (e) => {
    e.preventDefault();
    await api.updateProfile({ full_name: e.target.full_name.value.trim(), ai_consent: e.target.ai.checked });
    toast("Profile saved");
  });
  $("#add-acc", main).addEventListener("click", () => formSheet("Add an account", [
    { name: "kind", label: "Type", type: "select", options: [["bank", "Bank account"], ["cash", "Cash"], ["wallet", "Wallet (Paytm, PhonePe…)"]] },
    [{ name: "name", label: "Name", required: true, hint: "e.g. SBI savings" },
     { name: "last4", label: "Last 4 digits", hint: "Optional" }],
  ], "Add account", async (v) => {
    if (v.last4 && !/^\d{4}$/.test(v.last4)) throw new Error("Enter exactly 4 digits, or leave it empty.");
    await api.addAccount({ kind: v.kind, name: v.name, last4: v.last4 || null }); await refreshCache();
  }));
  $("#chg", main).addEventListener("click", () => {
    sheet("Change password", `<form class="form" id="f-chg"><label class="field">Current password<input name="current" type="password" autocomplete="current-password" required></label>
      ${passwordField("password", "New password")}<label class="field">Confirm new password<input name="confirm" type="password" autocomplete="new-password" required></label>
      <div class="error hidden"></div><button class="btn block">Change password</button></form>`, (root, close) => {
      const form = $("form", root);
      const check = bindPasswordRules(form, () => user.email || "", () => profile?.full_name || "");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = $(".error", form);
        try {
          if (!check().ok) throw new Error("Please choose a stronger password.");
          if (form.password.value !== form.confirm.value) throw new Error("The two new passwords don't match.");
          await api.verifyPassword(user.email, form.current.value);
          await api.changePassword(form.password.value);
          close(); toast("Password changed");
        } catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); }
      });
    });
  });
  $("#out", main).addEventListener("click", () => api.signOut(false));
  $("#out-all", main).addEventListener("click", () => { if (confirm("Sign out on every phone and computer?")) api.signOut(true); });
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------
async function onSignedIn(session) {
  user = session?.user ?? null;
  if (!user) { $("#root").innerHTML = ""; return render(); }
  await api.init(user);
  await refreshCache();
  $("#root").innerHTML = "";
  render();
}

async function start() {
  applyTheme();
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (getTheme() === "system") applyTheme("system"); });
  installTooltips();
  api = await createApi(config);
  // supabase-js holds a lock while it runs this callback; calling it again from inside
  // (as onSignedIn does) would wait forever. setTimeout runs the work after the lock is released.
  api.onAuth((event, session) => setTimeout(async () => {
    if (event === "PASSWORD_RECOVERY") { recovering = true; user = session?.user ?? null; return renderAuth(); }
    if (event === "SIGNED_OUT") { user = null; cache = { categories: [], accounts: [] }; $("#root").innerHTML = ""; return renderAuth(); }
    if (event === "SIGNED_IN" && (!user || user.id !== session?.user?.id)) {
      try { await onSignedIn(session); } catch (ex) {
        user = null; $("#root").innerHTML = ""; renderAuth();
        const err = $("#f-auth .error");
        if (err) { err.textContent = "Signed in, but your data could not load: " + ex.message; err.classList.remove("hidden"); }
      }
    }
  }, 0));
  const s = await api.session();
  if (s?.user && !user) await onSignedIn(s); else if (!user) renderAuth();
  window.addEventListener("hashchange", render);
  if ("serviceWorker" in navigator && !api.demo) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

start().catch((ex) => { $("#root").innerHTML = `<div class="auth-main"><div class="card error">Could not start: ${esc(ex.message)}</div></div>`; });
