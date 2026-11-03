/* ==========================================================
   CSV → data.json conversion rules.
   Used by converter.html (in the browser). Also works in Node:
     node assets/converter-core.js data/csv data/data.json
   ========================================================== */
(function (root) {

  /* ---------- CSV parsing (handles quotes, commas, and line breaks inside cells) ---------- */
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], cell = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }

    const header = (rows.shift() || []).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const records = [];
    rows.forEach((r, i) => {
      if (r.every(c => c.trim() === "")) return;            // skip blank lines
      const rec = { _row: i + 2 };                          // row number as shown in Excel/Sheets
      header.forEach((h, j) => { rec[h] = (r[j] || "").trim(); });
      records.push(rec);
    });
    return { header, records };
  }

  /* ---------- Figure out which file this is from its column names ---------- */
  function detectType(header) {
    const has = (...cols) => cols.every(c => header.includes(c));
    if (has("topic_code", "topic_name")) return "topics";
    if (has("amendment", "scenario", "explanation")) return "gameScenarios";
    if (has("question", "option_a", "correct_answer", "difficulty")) return "diagnostic";
    if (has("question", "option_a", "correct_answer")) return "quiz";
    if (has("topic", "question", "answer")) return "flashcards";
    return null;
  }

  const TYPE_INFO = {
    topics:        { label: "Topics",                   file: "topics.csv" },
    flashcards:    { label: "Flashcards",               file: "flashcards.csv" },
    quiz:          { label: "Practice quiz",            file: "quiz.csv" },
    gameScenarios: { label: "Constitutional Cases game", file: "game_scenarios.csv" },
    diagnostic:    { label: "Study recommendations",    file: "study_recommendations.csv" }
  };
  const ORDER = ["topics", "flashcards", "quiz", "gameScenarios", "diagnostic"];
  const DIFFICULTIES = ["basic", "intermediate", "advanced"];
  const WORD_NUMBERS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* "1", "1st", "First", "1st Amendment" → "1st" */
  function normalizeAmendment(value) {
    const v = value.toLowerCase().replace(/amendment/g, "").trim();
    const m = v.match(/^(\d+)/);
    if (m) return ordinal(parseInt(m[1], 10));
    if (WORD_NUMBERS[v]) return ordinal(WORD_NUMBERS[v]);
    return null;
  }

  /* Reads option_a, option_b, ... and the correct_answer letter. */
  function readOptions(rec, problems) {
    const letters = "abcdef".split("").filter(l => ("option_" + l) in rec);
    const raw = letters.map(l => rec["option_" + l]);
    const letter = (rec.correct_answer || "").toUpperCase().replace(/[^A-F]/g, "");
    const at = letter ? letter.charCodeAt(0) - 65 : -1;

    if (!letter || letter.length !== 1) {
      problems.push(`correct_answer should be one letter (A, B, C, or D) but is "${rec.correct_answer}"`);
      return null;
    }
    if (at >= raw.length || !raw[at]) {
      problems.push(`correct_answer is ${letter}, but option_${letter.toLowerCase()} is empty`);
      return null;
    }
    // Drop blank options, keeping track of where the correct one ends up
    const options = [];
    let correct = -1;
    raw.forEach((o, i) => { if (o) { if (i === at) correct = options.length; options.push(o); } });
    if (options.length < 2) {
      problems.push("needs at least 2 answer options");
      return null;
    }
    return { options, correct };
  }

  /* ---------- Turn parsed records into clean data, collecting problems ---------- */
  function convert(type, records, topicCodes) {
    const items = [], errors = [], warnings = [];
    const checkTopic = (rec, problems) => {
      if (!rec.topic) problems.push("topic is empty");
      else if (topicCodes && !topicCodes.has(rec.topic)) {
        problems.push(`topic "${rec.topic}" isn't in topics.csv (use one of: ${[...topicCodes].join(", ")})`);
      }
    };

    records.forEach(rec => {
      const p = [];
      let item = null;

      if (type === "topics") {
        if (!rec.topic_code) p.push("topic_code is empty");
        else if (!/^[a-z0-9_-]+$/i.test(rec.topic_code)) p.push(`topic_code "${rec.topic_code}" should be one word (letters, numbers, - or _)`);
        if (!rec.topic_name) p.push("topic_name is empty");
        item = { code: rec.topic_code, name: rec.topic_name };
      }

      if (type === "flashcards") {
        checkTopic(rec, p);
        if (!rec.question) p.push("question is empty");
        if (!rec.answer) p.push("answer is empty");
        item = { topic: rec.topic, question: rec.question, answer: rec.answer };
      }

      if (type === "quiz" || type === "diagnostic") {
        if (!rec.question) p.push("question is empty");
        const o = readOptions(rec, p);
        if (type === "quiz") {
          if (rec.topic) checkTopic(rec, p);
          item = o && { question: rec.question, options: o.options, correct: o.correct, topic: rec.topic || "" };
        } else {
          checkTopic(rec, p);
          const d = (rec.difficulty || "").toLowerCase();
          if (!DIFFICULTIES.includes(d)) p.push(`difficulty should be basic, intermediate, or advanced but is "${rec.difficulty}"`);
          item = o && { topic: rec.topic, difficulty: d, question: rec.question, options: o.options, correct: o.correct };
        }
      }

      if (type === "gameScenarios") {
        const a = normalizeAmendment(rec.amendment || "");
        if (!a) p.push(`amendment should look like "1st" or "4th" but is "${rec.amendment}"`);
        if (!rec.scenario) p.push("scenario is empty");
        if (!rec.explanation) p.push("explanation is empty");
        item = { amendment: a, scenario: rec.scenario, explanation: rec.explanation };
      }

      if (p.length) p.forEach(msg => errors.push({ row: rec._row, message: msg }));
      else if (item) items.push(item);
    });

    if (type === "topics") {
      const seen = new Set();
      items.forEach(t => { if (seen.has(t.code)) errors.push({ row: null, message: `topic_code "${t.code}" is listed twice` }); seen.add(t.code); });
    }
    if (type === "gameScenarios") {
      const n = new Set(items.map(i => i.amendment)).size;
      if (n > 0 && n < 4) warnings.push(`Only ${n} different amendments, so the game will show fewer than 4 answer choices.`);
    }
    if (!records.length) warnings.push("This file has no rows.");
    return { items, errors, warnings };
  }

  /* ---------- Build the full data.json object ----------
     files: [{ name, text }]   base: the current data.json (optional)
     Sections you don't upload are copied from base. */
  function build(files, base) {
    const report = [];
    const parsed = {};
    files.forEach(f => {
      const { header, records } = parseCSV(f.text);
      const type = detectType(header);
      if (!type) {
        report.push({ name: f.name, type: null, count: 0, errors: [{ row: 1,
          message: "Couldn't tell which file this is from its column names: " + header.join(", ") }], warnings: [] });
        return;
      }
      if (parsed[type]) {
        report.push({ name: f.name, type, count: 0, errors: [{ row: null,
          message: `Two ${TYPE_INFO[type].label} files were uploaded (${parsed[type].name} and ${f.name}). Upload just one.` }], warnings: [] });
        return;
      }
      parsed[type] = { name: f.name, records };
    });

    const data = { generated: new Date().toISOString() };

    // Topics first, because other files are checked against them
    let topicCodes = null;
    if (parsed.topics) {
      const r = convert("topics", parsed.topics.records, null);
      report.push({ name: parsed.topics.name, type: "topics", count: r.items.length, errors: r.errors, warnings: r.warnings });
      data.topics = r.items;
    } else if (base && base.topics) {
      data.topics = base.topics;
    }
    if (data.topics) topicCodes = new Set(data.topics.map(t => t.code));

    ORDER.slice(1).forEach(type => {
      if (parsed[type]) {
        const r = convert(type, parsed[type].records, topicCodes);
        report.push({ name: parsed[type].name, type, count: r.items.length, errors: r.errors, warnings: r.warnings });
        data[type] = r.items;
      } else if (base && base[type]) {
        data[type] = base[type];
      }
    });

    const missing = ORDER.filter(t => !data[t]);
    const ok = missing.length === 0 && report.every(r => r.errors.length === 0);
    // Put keys in a tidy order
    const ordered = { generated: data.generated };
    ORDER.forEach(t => { if (data[t]) ordered[t] = data[t]; });
    return { data: ordered, report, missing, ok };
  }

  const api = { parseCSV, detectType, convert, build, normalizeAmendment, TYPE_INFO, ORDER };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    // Command-line use: node assets/converter-core.js <csv-folder> <output.json>
    if (require.main === module) {
      const fs = require("fs"), path = require("path");
      const [dir = "data/csv", out = "data/data.json"] = process.argv.slice(2);
      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".csv"))
        .map(f => ({ name: f, text: fs.readFileSync(path.join(dir, f), "utf8") }));
      const base = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
      const result = build(files, base);
      result.report.forEach(r => {
        console.log(`${r.name}: ${r.type ? TYPE_INFO[r.type].label : "unknown"}, ${r.count} items`);
        r.errors.forEach(e => console.log(`  ERROR${e.row ? " row " + e.row : ""}: ${e.message}`));
        r.warnings.forEach(w => console.log(`  note: ${w}`));
      });
      if (result.missing.length) console.log("Missing sections: " + result.missing.join(", "));
      if (!result.ok) { console.log("Not saved: fix the errors above first."); process.exit(1); }
      fs.writeFileSync(out, JSON.stringify(result.data, null, 2));
      console.log("Saved " + out);
    }
  } else {
    root.Converter = api;
  }
})(this);
