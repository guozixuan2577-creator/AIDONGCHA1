import {
  askTown,
  authStatus,
  getResidentProfile,
  hasDeepSeekKey,
  loadTownState,
  publicResident,
  publicResidentDetail,
  requireBrainAuth,
  residentBrain,
  townOverview,
} from "../lib/town-core.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type,authorization,x-api-token");
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

function getPath(req) {
  const url = new URL(req.url || "/", "http://localhost");
  return url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
}

function methodNotAllowed(res) {
  return send(res, 405, { error: "Method not allowed." });
}

function badRequest(res, message) {
  return send(res, 400, { error: "Bad request", message });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const state = await loadTownState();
    const parts = getPath(req);
    const [resource, id] = parts;

    if (req.method === "GET" && resource === "health") {
      const auth = authStatus(req.headers);
      return send(res, 200, {
        ok: true,
        runtime: "vercel-functions",
        residents: state.residents.length,
        resident_profiles: state.residentProfiles.size,
        evidence: state.evidence.length,
        market_knowledge: state.market.length,
        has_deepseek_key: hasDeepSeekKey(),
        api_token_configured: auth.apiConfigured,
      });
    }

    if (resource === "brain") {
      if (req.method !== "POST") return methodNotAllowed(res);
      if (!requireBrainAuth(req.headers)) {
        return send(res, 401, {
          error: "Unauthorized",
          message: "需要提供有效的 API_TOKEN。",
        });
      }
      const body = await readBody(req);
      if (!id) return badRequest(res, "resident_id is required in /api/brain/:resident_id.");
      if (!body.question) return badRequest(res, "question is required.");
      const result = await residentBrain({
        state,
        respondentId: id,
        question: body.question,
        context: body.context || "",
        outputLanguage: body.output_language || "zh",
        debug: Boolean(body.debug),
      });
      return send(res, result.status, result.body);
    }

    if (req.method === "GET" && resource === "town-overview") {
      return send(res, 200, townOverview(state));
    }

    if (req.method === "GET" && resource === "residents" && !id) {
      return send(res, 200, state.residents.map(publicResident));
    }

    if (req.method === "GET" && resource === "residents" && id) {
      const profile = getResidentProfile(state, id);
      if (!profile) return send(res, 404, { error: "Resident not found." });
      return send(res, 200, publicResidentDetail(profile));
    }

    if (req.method === "POST" && resource === "ask-resident") {
      const body = await readBody(req);
      const respondentId = body.respondent_id || body.resident_id;
      if (!respondentId) return badRequest(res, "respondent_id is required.");
      if (!body.question) return badRequest(res, "question is required.");
      const result = await residentBrain({
        state,
        respondentId,
        question: body.question,
        context: body.context || "",
        outputLanguage: body.output_language || "zh",
        debug: Boolean(body.debug),
      });
      return send(res, result.status, result.body);
    }

    if (req.method === "POST" && resource === "ask-town") {
      const body = await readBody(req);
      if (!body.question) return badRequest(res, "question is required.");
      const result = await askTown({
        state,
        question: body.question,
        outputLanguage: body.output_language || "zh",
        debug: Boolean(body.debug),
      });
      return send(res, result.status, result.body);
    }

    return send(res, 404, { error: "Not found." });
  } catch (error) {
    return send(res, 500, {
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
