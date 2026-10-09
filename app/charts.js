// Small SVG chart kit for FreedomDay. No libraries.
// Rules (dataviz method): thin marks, 4px rounded data-ends, 2px surface gaps,
// hairline grid, legend whenever there are 2+ series, values printed beside
// colours (never colour alone), tooltip on every mark via [data-tip].

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Progress ring (a meter): fill = the value, track = same hue, lighter.
export function ring(pct, { size = 160, stroke = 12, color = "var(--c-1)", label = "", center = "" } = {}) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, dash = (p / 100) * c;
  return `<div class="ring-wrap" style="width:${size}px;max-width:100%" role="img" aria-label="${esc(label)} ${p}%">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-opacity=".16" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${dash} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-fill" style="--len:${c}"/>
    </svg><div class="center">${center}</div></div>`;
}

// Donut for part-to-whole (<= 6 segments). 2px surface gaps between segments.
export function donut(segments, { size = 180, stroke = 22, center = "", fmt = (v) => v } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, gap = segments.length > 1 ? 2 : 0;
  let offset = 0;
  const arcs = total > 0 ? segments.filter((s) => s.value > 0).map((s) => {
    const len = (s.value / total) * c;
    const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
      stroke-dasharray="${Math.max(len - gap, 0.5)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})"
      tabindex="0" data-tip="${esc(s.label)}|${esc(fmt(s.value))} · ${Math.round((s.value / total) * 100)}%"/>`;
    offset += len;
    return seg;
  }).join("") : "";
  return `<div class="ring-wrap" style="width:${size}px;max-width:100%" role="img" aria-label="${esc(segments.map((s) => `${s.label} ${fmt(s.value)}`).join(", "))}">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>${arcs}
    </svg><div class="center">${center}</div></div>`;
}

// Legend that doubles as the data table: swatch, name, value, share.
export function legend(segments, fmt) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return `<div class="legend">${segments.map((s) => `<div class="key"><span class="sw" style="background:${s.color}"></span>
    <span class="text-2">${esc(s.label)}</span><span class="val tnum">${esc(fmt(s.value))}<span class="pct">${Math.round((s.value / total) * 100)}%</span></span></div>`).join("")}</div>`;
}

// 7-day columns with a target reference line (one series, one axis).
// Plain HTML columns, so labels never stretch with the card width.
export function weekBars(days, target, { fmt = (v) => v, height = 140 } = {}) {
  const max = Math.max(target, ...days.map((d) => d.value), 1) * 1.15;
  const h = (v) => Math.round((v / max) * 1000) / 10;
  const cols = days.map((d) => `<div class="wb-col" tabindex="0" data-tip="${esc(d.tipLabel)}|${esc(fmt(d.value))}">
      <div class="wb-track"><span class="wb-bar ${d.value >= target && target > 0 ? "hit" : ""}" style="height:${d.value > 0 ? Math.max(h(d.value), 2) : 0}%"></span></div>
      <span class="wb-label ${d.today ? "today" : ""}">${esc(d.label)}</span></div>`).join("");
  const line = target > 0 ? `<div class="wb-target" style="bottom:calc(${h(target)}% * (${height} - 22) / ${height} + 22px)"><span>Daily target ${esc(fmt(target))}</span></div>` : "";
  return `<div class="wb" style="height:${height}px" role="img" aria-label="Income for the last 7 days against the daily target of ${esc(fmt(target))}">${line}${cols}</div>`;
}

// Horizontal stacked allocation bar with 2px gaps.
export function allocBar(segments, fmt) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return `<div class="alloc" role="img" aria-label="${esc(segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", "))}">
    ${segments.filter((s) => s.value > 0).map((s) => `<span style="width:${(s.value / total) * 100}%;background:${s.color}" tabindex="0" data-tip="${esc(s.label)}|${esc(fmt(s.value))} · ${Math.round((s.value / total) * 100)}%"></span>`).join("")}</div>`;
}

// One tooltip for the whole app: hover, keyboard focus, or tap.
export function installTooltips() {
  let tip;
  const show = (el) => {
    const [title, value] = (el.getAttribute("data-tip") || "").split("|");
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
    tip.innerHTML = `<b>${esc(value)}</b>${esc(title)}`;
    const r = el.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(r.left + r.width / 2, 80), innerWidth - 80)}px`;
    tip.style.top = `${r.top}px`;
    tip.hidden = false;
  };
  const hide = () => { if (tip) tip.hidden = true; };
  const target = (e) => e.target.closest?.("[data-tip]");
  document.addEventListener("pointerover", (e) => { const t = target(e); t ? show(t) : hide(); });
  document.addEventListener("focusin", (e) => { const t = target(e); t ? show(t) : hide(); });
  document.addEventListener("pointerdown", (e) => { const t = target(e); t ? show(t) : hide(); });
  document.addEventListener("scroll", hide, true);
}

// Count-up for hero numbers (skipped when the user prefers less motion).
export function countUp(el, to, fmt, ms = 700) {
  if (!el) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !to) { el.textContent = fmt(to); return; }
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
