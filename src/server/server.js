const path = require("path");
const express = require("express");
const { evaluate } = require("../core/verdict");
const { basicAuth } = require("./auth");
const { createDb } = require("./db");

const app = express();
const db = createDb();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use(basicAuth);

app.use("/", express.static(path.join(__dirname, "..", "web")));

app.post("/api/evaluate", (req, res) => {
  try {
    const result = evaluate(req.body);
    const stmt = db.prepare(
      "INSERT INTO evaluations (created_at, payload, result) VALUES (?, ?, ?)"
    );
    stmt.run(
      new Date().toISOString(),
      JSON.stringify(req.body),
      JSON.stringify(result)
    );
    res.json(result);
  } catch (e) {
    if (e && e.code === "VALIDATION_ERROR") {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: e.details });
    }
    res.status(500).json({ error: "INTERNAL_ERROR", message: String(e && e.message ? e.message : e) });
  }
});

app.get("/api/history", (req, res) => {
  const limitRaw = req.query.limit;
  const limit = Number.isFinite(Number(limitRaw)) ? Math.min(Number(limitRaw), 200) : 50;
  const rows = db
    .prepare("SELECT id, created_at, payload, result FROM evaluations ORDER BY id DESC LIMIT ?")
    .all(limit);
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      payload: JSON.parse(r.payload),
      result: JSON.parse(r.result),
    })),
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Verdict running on http://localhost:${port}`);
});
