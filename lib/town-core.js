import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data", "processed");
let cachedState = null;

async function readJson(name, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, name), "utf-8"));
  } catch {
    return fallback;
  }
}

export async function loadTownState() {
  if (cachedState) return cachedState;
  const residents = await readJson("residents.json", []);
  const profiles = await readJson("resident_profiles.json", []);
  cachedState = {
    residents,
    evidence: await readJson("interview_evidence.json", []),
    market: await readJson("market_knowledge.json", []),
    report: {},
    residentProfiles: new Map(profiles.map((p) => [p.respondent_id, p])),
  };
  for (const resident of residents) {
    if (!cachedState.residentProfiles.has(resident.respondent_id)) cachedState.residentProfiles.set(resident.respondent_id, resident);
  }
  return cachedState;
}

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const list = (value) => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
const norm = (value) => clean(value).toLowerCase();

function countBy(items, getter) {
  const counts = new Map();
  for (const item of items) {
    for (const value of list(getter(item))) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

export function hasDeepSeekKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

function getHeader(headers, name) {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === lower) return Array.isArray(value) ? value[0] : value;
  }
  return "";
}

export function authStatus(headers = {}) {
  const token = process.env.API_TOKEN || "";
  const bearer = String(getHeader(headers, "authorization")).replace(/^Bearer\s+/i, "");
  const apiHeader = String(getHeader(headers, "x-api-token") || "");
  return { apiConfigured: Boolean(token), apiAuthorized: Boolean(token) && (bearer === token || apiHeader === token) };
}

export function requireBrainAuth(headers) {
  return authStatus(headers).apiAuthorized;
}

export function publicResident(resident) {
  return {
    respondent_id: resident.respondent_id,
    display_name: resident.display_name,
    current_phone_raw: resident.current_phone_raw,
    evidence_count: resident.evidence_count || 0,
    profile: resident.profile || {},
    representative_quotes: resident.representative_quotes || [],
  };
}

export function getResidentProfile(state, respondentId) {
  return state.residentProfiles.get(respondentId) || state.residents.find((r) => r.respondent_id === respondentId) || null;
}

export function publicResidentDetail(profile) {
  return {
    respondent_id: profile.respondent_id,
    display_name: clean(profile.display_name),
    current_phone_raw: profile.current_phone_raw,
    base_profile: profile.base_profile || profile.profile || {},
    life_context: profile.life_context || profile.profile || {},
    mobile_decision_model: profile.mobile_decision_model || profile.profile || {},
    pakistan_context_overlay: profile.pakistan_context_overlay || [],
    representative_quotes: profile.representative_quotes || [],
    evidence_coverage: profile.evidence_coverage || {},
  };
}

export function townOverview(state) {
  const residents = state.residents;
  return {
    resident_count: residents.length,
    evidence_count: state.evidence.length,
    valid_evidence_count: state.evidence.length,
    market_knowledge_count: state.market.length,
    phone_brand_distribution: countBy(residents, (r) => {
      const phone = norm(r.current_phone_raw);
      if (phone.includes("samsung") || phone.includes("galaxy") || phone.includes("glaxy")) return "Samsung";
      if (phone.includes("vivo")) return "vivo";
      if (phone.includes("infinix") || phone.includes("hot")) return "Infinix";
      return r.current_phone_raw || "Unknown";
    }),
    identity_distribution: countBy(residents, (r) => r.profile?.occupation_or_role || r.profile?.life_stage || "未知"),
    price_sensitivity: { high: residents.filter((r) => r.profile?.price_sensitivity === "high").length },
    top_usage_scenarios: countBy(residents, (r) => r.profile?.phone_usage_scenario || []).slice(0, 8),
    top_valued_features: countBy(residents, (r) => r.profile?.valued_features || []).slice(0, 8),
    commonalities: ["用户会把手机放进学习、工作、家庭沟通、社交、拍照或内容创作等真实日常场景里判断。", "价格、耐用、相机、电池、存储和品牌信任会共同影响购买决策。"],
    differences: ["学生更看重预算和学习场景。", "创作者更看重相机、屏幕、外观和存储。", "工作相关用户更看重稳定、电池、通话和客户沟通。"],
  };
}

export function analyzeQuestion(question) {
  const text = norm(question);
  const intents = [];
  if (/price|budget|pkr|涨价|价格|预算|贵/.test(text)) intents.push("价格敏感");
  if (/buy|purchase|会买|购买|换机/.test(text)) intents.push("购买决策");
  if (/camera|photo|拍照|相机|视频/.test(text)) intents.push("影像场景");
  if (/battery|charge|电池|续航|快充/.test(text)) intents.push("续航充电");
  if (/brand|samsung|infinix|tecno|vivo|oppo|品牌/.test(text)) intents.push("品牌态度");
  if (!intents.length) intents.push("开放问题");
  return { original_question: question, intent_types: intents, focus_terms: text.split(/\s+/).slice(0, 12) };
}

function evidenceFor(state, respondentId, limit = 5) {
  return state.evidence.filter((e) => !respondentId || e.respondent_id === respondentId).slice(0, limit);
}

function supportBasis(profile, evidence) {
  const p = profile.profile || profile.base_profile || {};
  const basis = [];
  basis.push(`居民画像：${clean(profile.display_name)} / ${profile.current_phone_raw || "unknown"}`);
  if (p.occupation_or_role || p.city_or_area) basis.push(`身份背景：${[p.occupation_or_role, p.city_or_area].filter(Boolean).join(" / ")}`);
  if (p.valued_features?.length) basis.push(`重视功能：${p.valued_features.slice(0, 4).join(" / ")}`);
  if (evidence[0]?.answer_text_clean) basis.push(`访谈原文：${clean(evidence[0].answer_text_clean).slice(0, 140)}`);
  return basis.slice(0, 4);
}

function modelRequired(residentId = "") {
  return {
    resident_id: residentId,
    answer_title: "需要配置 DeepSeek API Key",
    answer: "用户小镇已经部署好，但还没有检测到 DEEPSEEK_API_KEY。请在 Vercel 项目的 Environment Variables 里添加 DEEPSEEK_API_KEY，并重新部署。",
    decision: "无法判断",
    relevance_score: 0,
    confidence_label: "低",
    supporting_basis: ["当前服务未检测到 DEEPSEEK_API_KEY。"],
    model_required: true,
  };
}

async function callDeepSeek({ profile, evidence, market, question, outputLanguage }) {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const body = {
    model,
    messages: [
      { role: "system", content: "你是巴基斯坦手机消费者用户小镇里的一个真实受访者模拟大脑。结合居民画像、访谈证据和市场背景，直接回答用户问题。默认用中文第一人称，不要编造证据之外的个人经历。" },
      { role: "user", content: JSON.stringify({ question, output_language: outputLanguage, resident_profile: profile, interview_evidence: evidence, market_context: market }, null, 2) },
    ],
    temperature: 0.45,
  };
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`DeepSeek API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim() || "";
}

function inferDecision(answer) {
  const text = norm(answer);
  if (/不会|不买|拒绝|not buy|too expensive/.test(text)) return "不会买";
  if (/犹豫|谨慎|看条件|如果|预算|maybe|worth/.test(text)) return "会犹豫";
  if (/会买|接受|愿意|buy|accept|yes/.test(text)) return "会买";
  return "看条件";
}

export async function residentBrain({ state, respondentId, question, context = "", outputLanguage = "zh", debug = false }) {
  const profile = getResidentProfile(state, respondentId);
  if (!profile) return { status: 404, body: { error: "Resident not found." } };
  if (!hasDeepSeekKey()) return { status: 428, body: modelRequired(respondentId) };
  const evidence = evidenceFor(state, respondentId, 5);
  const market = state.market.slice(0, 4);
  const answer = await callDeepSeek({ profile, evidence, market, question: `${question}\n${context}`, outputLanguage });
  const body = {
    resident_id: respondentId,
    display_name: clean(profile.display_name),
    answer_title: answer.split(/\n+/).find(Boolean)?.slice(0, 42) || "居民结论",
    answer,
    decision: inferDecision(answer),
    relevance_score: evidence.length ? 0.72 : 0.5,
    confidence_label: evidence.length ? "中" : "低",
    supporting_basis: supportBasis(profile, evidence),
    model_required: false,
  };
  if (debug) body.hidden_diagnostics = { question_analysis: analyzeQuestion(question), evidence };
  return { status: 200, body };
}

export async function askTown({ state, question, outputLanguage = "zh", debug = false }) {
  if (!hasDeepSeekKey()) return { status: 428, body: modelRequired("town") };
  const results = [];
  for (const resident of state.residents) {
    const result = await residentBrain({ state, respondentId: resident.respondent_id, question, outputLanguage, debug });
    if (result.status === 200) results.push(result.body);
  }
  const groups = {
    accepted: results.filter((r) => r.decision === "会买").map((r) => r.display_name),
    hesitant: results.filter((r) => ["会犹豫", "看条件"].includes(r.decision)).map((r) => r.display_name),
    rejected: results.filter((r) => r.decision === "不会买").map((r) => r.display_name),
    insufficient: [],
  };
  return { status: 200, body: { summary_answer: [`更可能接受：${groups.accepted.join("、") || "暂无"}`, `会犹豫或看条件：${groups.hesitant.join("、") || "暂无"}`, `可能拒绝：${groups.rejected.join("、") || "暂无"}`].join("\n"), resident_groups: groups, resident_answers: results } };
}
