const state = { residents: [], overview: null, mode: "single" };
const $ = (selector) => document.querySelector(selector);
const els = {
  healthBadge: $("#healthBadge"), overviewGrid: $("#overviewGrid"), overviewInsights: $("#overviewInsights"),
  residentSelect: $("#residentSelect"), residentList: $("#residentList"), residentCount: $("#residentCount"),
  questionInput: $("#questionInput"), languageSelect: $("#languageSelect"), answerArea: $("#answerArea"),
  askBtn: $("#askBtn"), sampleBtn: $("#sampleBtn"), refreshBtn: $("#refreshBtn"), residentDialog: $("#residentDialog"),
  closeDetailBtn: $("#closeDetailBtn"), detailName: $("#detailName"), residentDetail: $("#residentDetail"),
};
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || data.answer || data.error || "请求失败"); error.payload = data; error.status = response.status; throw error; }
  return data;
}
function tags(items, limit = 6) { const values = (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, limit); return values.length ? `<ul class="tag-list">${values.map((item) => `<li class="tag">${escapeHtml(item)}</li>`).join("")}</ul>` : ""; }
function renderMetric(value, label) { return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`; }
function renderOverview() {
  const o = state.overview; if (!o) return;
  els.overviewGrid.innerHTML = [renderMetric(o.resident_count, "真实居民"), renderMetric(o.valid_evidence_count, "有效访谈证据"), renderMetric(o.market_knowledge_count, "市场知识片段"), renderMetric(o.price_sensitivity?.high || 0, "高价格敏感")].join("");
  const blocks = [["手机品牌分布", o.phone_brand_distribution], ["身份/职业分布", o.identity_distribution], ["主要使用场景", o.top_usage_scenarios], ["重视功能", o.top_valued_features]];
  els.overviewInsights.innerHTML = [...blocks.map(([title, items]) => `<div class="insight-block"><h3>${escapeHtml(title)}</h3>${tags((items || []).map((item) => `${item.label} ${item.count}`), 8)}</div>`), `<div class="insight-block"><h3>共性</h3><p>${escapeHtml((o.commonalities || []).join(" "))}</p></div>`, `<div class="insight-block"><h3>差异</h3><p>${escapeHtml((o.differences || []).join(" "))}</p></div>`].join("");
}
function residentTitle(resident) { return String(resident.display_name || resident.respondent_id || "").replace(/\s+/g, " ").trim(); }
function renderResidents() {
  els.residentCount.textContent = `${state.residents.length} 位`;
  els.residentSelect.innerHTML = state.residents.map((r) => `<option value="${escapeHtml(r.respondent_id)}">${escapeHtml(residentTitle(r))}</option>`).join("");
  els.residentList.innerHTML = state.residents.map((r) => { const p = r.profile || {}; const tagValues = [p.occupation_or_role, p.city_or_area, p.price_sensitivity ? `价格敏感：${p.price_sensitivity}` : "", `${r.evidence_count || 0} 条证据`].filter(Boolean); const featureText = [...(p.valued_features || []).slice(0, 3), ...(p.phone_usage_scenario || []).slice(0, 2)].join(" / "); return `<button class="resident-card" type="button" data-resident-id="${escapeHtml(r.respondent_id)}"><h3>${escapeHtml(residentTitle(r))}</h3><p>${escapeHtml(r.current_phone_raw || "当前手机未知")}</p><p>${escapeHtml(featureText || "点击查看居民画像")}</p>${tags(tagValues, 5)}</button>`; }).join("");
}
function renderBasis(items) { const values = (items || []).filter(Boolean).slice(0, 4); return values.length ? `<ul class="basis-list">${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""; }
function renderSingleAnswer(payload) { return `<article class="answer-card"><h3>${escapeHtml(payload.answer_title || "居民结论")}</h3><div class="answer-meta"><span class="status-pill ready">${escapeHtml(payload.display_name || payload.resident_id || "居民")}</span><span class="status-pill">决策：${escapeHtml(payload.decision || "看条件")}</span><span class="status-pill">相关性：${escapeHtml(payload.relevance_score ?? "-")}</span><span class="status-pill">置信度：${escapeHtml(payload.confidence_label || "-")}</span></div><p>${escapeHtml(payload.answer || "").replaceAll("\n", "<br />")}</p>${renderBasis(payload.supporting_basis)}</article>`; }
function renderTownAnswer(payload) {
  const groups = payload.resident_groups || {}; const groupCards = [["接受", groups.accepted], ["犹豫/看条件", groups.hesitant], ["拒绝", groups.rejected], ["证据不足", groups.insufficient]].map(([title, names]) => `<div class="insight-block"><h3>${escapeHtml(title)}</h3><p>${escapeHtml((names || []).join("、") || "暂无")}</p></div>`).join("");
  return `<article class="answer-card"><h3>全镇综合结论</h3><p>${escapeHtml(payload.summary_answer || "暂无总结").replaceAll("\n", "<br />")}</p><div class="insight-grid">${groupCards}</div></article>${(payload.resident_answers || []).map(renderSingleAnswer).join("")}`;
}
function renderModelRequired(payload) { return `<article class="answer-card"><h3>${escapeHtml(payload.answer_title || "需要配置 DeepSeek")}</h3><p>${escapeHtml(payload.answer || "请在 Vercel 环境变量里配置 DEEPSEEK_API_KEY。")}</p>${renderBasis(payload.supporting_basis)}</article>`; }
async function loadBasics() {
  const health = await fetch("/api/health").then((response) => response.json());
  els.healthBadge.textContent = health.has_deepseek_key ? "DeepSeek 已连接" : "待配置 DeepSeek";
  els.healthBadge.className = `status-pill ${health.has_deepseek_key ? "ready" : "warn"}`;
  const [overview, residents] = await Promise.all([api("/api/town-overview"), api("/api/residents")]);
  state.overview = overview; state.residents = residents; renderOverview(); renderResidents();
}
async function ask() {
  const question = els.questionInput.value.trim(); if (!question) { els.answerArea.innerHTML = `<p class="error-state">请先输入问题。</p>`; return; }
  els.askBtn.disabled = true; els.answerArea.classList.add("loading"); els.answerArea.innerHTML = `<p class="empty-state">居民正在结合画像、访谈证据和市场背景生成回答...</p>`;
  try {
    const body = { question, output_language: els.languageSelect.value, debug: false };
    if (state.mode === "single") { body.respondent_id = els.residentSelect.value; els.answerArea.innerHTML = renderSingleAnswer(await api("/api/ask-resident", { method: "POST", body: JSON.stringify(body) })); }
    else { els.answerArea.innerHTML = renderTownAnswer(await api("/api/ask-town", { method: "POST", body: JSON.stringify(body) })); }
  } catch (error) { els.answerArea.innerHTML = error.status === 428 && error.payload ? renderModelRequired(error.payload) : `<p class="error-state">${escapeHtml(error.message)}</p>`; }
  finally { els.askBtn.disabled = false; els.answerArea.classList.remove("loading"); }
}
async function openResidentDetail(id) {
  els.detailName.textContent = "加载中"; els.residentDetail.innerHTML = `<p class="empty-state">正在读取居民详情...</p>`; els.residentDialog.showModal();
  try { const d = await api(`/api/residents/${encodeURIComponent(id)}`); els.detailName.textContent = d.display_name || d.respondent_id; const p = d.base_profile || {}; const life = d.life_context || {}; const m = d.mobile_decision_model || {}; const q = d.representative_quotes || []; els.residentDetail.innerHTML = [["基础画像", [p.occupation_or_role, p.city_or_area, d.current_phone_raw].filter(Boolean).join(" / ")], ["生活现实", life.daily_routine || p.family_context || p.future_goal], ["手机决策逻辑", [...(m.valued_features || []), m.price_sensitivity ? `价格敏感：${m.price_sensitivity}` : ""].filter(Boolean).join(" / ")], ["代表原话", q.map((x) => x.quote_display_text || x.quote || x).slice(0, 4).join("\n")]].map(([title, text]) => `<div class="detail-block"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text || "暂无明确证据")}</p></div>`).join(""); }
  catch (error) { els.residentDetail.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`; }
}
function setMode(mode) { state.mode = mode; document.querySelectorAll(".segment").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode)); els.residentSelect.disabled = mode === "town"; }
document.querySelectorAll(".segment").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
els.askBtn.addEventListener("click", ask); els.sampleBtn.addEventListener("click", () => { els.questionInput.value = "如果 HOT 70 Pro 涨价 5000 PKR，哪些居民还会买？为什么？"; els.questionInput.focus(); });
els.refreshBtn.addEventListener("click", () => loadBasics().catch(showLoadError)); els.closeDetailBtn.addEventListener("click", () => els.residentDialog.close());
els.residentList.addEventListener("click", (event) => { const card = event.target.closest("[data-resident-id]"); if (card) openResidentDetail(card.dataset.residentId); });
function showLoadError(error) { els.overviewGrid.innerHTML = ""; els.overviewInsights.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`; els.residentList.innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`; }
setMode("single"); loadBasics().catch(showLoadError);
