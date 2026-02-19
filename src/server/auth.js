function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function basicAuth(req, res, next) {
  const user = process.env.VERDICT_USER || "";
  const pass = process.env.VERDICT_PASS || "";

  if (!user || !pass) {
    return res.status(500).json({ error: "ServerAuthNotConfigured" });
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Verdict"');
    return res.status(401).end();
  }

  const raw = Buffer.from(header.slice(6), "base64").toString("utf8");
  const idx = raw.indexOf(":");
  const u = idx >= 0 ? raw.slice(0, idx) : "";
  const p = idx >= 0 ? raw.slice(idx + 1) : "";

  const ok = constantTimeEqual(u, user) && constantTimeEqual(p, pass);
  if (!ok) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Verdict"');
    return res.status(401).end();
  }

  next();
}

module.exports = { basicAuth };
