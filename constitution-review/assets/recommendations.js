/* Study Recommendations: a short adaptive check across every topic.
   How it works:
   - Each topic gets QUESTIONS_PER_TOPIC questions, mixed together in random order.
   - Every topic starts at "basic". A correct answer moves that topic up one level
     (basic → intermediate → advanced); a wrong answer moves it down one level.
   - Questions are picked at random from the right level, so retakes are different.
   - Harder questions count more (basic 1, intermediate 2, advanced 3) in each topic's score.
   - Results list the weakest topics first, with links and a review of missed questions. */
(async function () {
  const data = await loadSiteData();
  if (!data) return;

  const QUESTIONS_PER_TOPIC = 4;
  const LEVELS = ["basic", "intermediate", "advanced"];
  const WEIGHT = { basic: 1, intermediate: 2, advanced: 3 };
  const SHORT_ANSWER_POINTS = 5;

  const topics = data.topics.filter(t => data.diagnostic.some(q => q.topic === t.code));
  const perTopic = t => Math.min(QUESTIONS_PER_TOPIC, data.diagnostic.filter(q => q.topic === t.code).length);
  const total = topics.reduce((n, t) => n + perTopic(t), 0);

  document.getElementById("diag-intro").textContent =
    `Answer ${total} questions, ${QUESTIONS_PER_TOPIC} from each topic (about ${Math.max(5, Math.round(total / 2))} minutes). ` +
    "The questions get harder when you answer correctly and easier when you miss one. " +
    "At the end you'll see which topics to study first, with links to the right flashcards and practice quiz.";

  let order, used, state, answers, current, picked, step;
  const nextBtn = document.getElementById("diag-next");

  function start() {
    // Interleave topics: each round asks every topic once, in a random order
    order = [];
    for (let r = 0; r < QUESTIONS_PER_TOPIC; r++) {
      shuffle(topics).forEach(t => { if (r < perTopic(t)) order.push(t.code); });
    }
    used = new Set();
    state = {};
    topics.forEach(t => { state[t.code] = { level: 0 }; });
    answers = [];
    step = 0;
    hide("diag-start"); hide("diag-results"); show("diag-content");
    ask();
  }

  // Random unused question for this topic at the target level, or the nearest level that has one
  function pick(topic, level) {
    for (const d of [0, -1, 1, -2, 2]) {
      const lv = LEVELS[level + d];
      if (!lv) continue;
      const pool = data.diagnostic.filter(q => q.topic === topic && q.difficulty === lv && !used.has(q));
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    }
    return null;
  }

  function ask() {
    if (step >= order.length) return results();
    const topic = order[step];
    current = pick(topic, state[topic].level);
    if (!current) { step++; return ask(); }
    used.add(current);
    picked = null;

    document.getElementById("diag-progress").textContent = `Question ${step + 1} of ${order.length}`;
    document.getElementById("diag-topic").textContent = data.topicNames[topic] || topic;
    document.getElementById("diag-level").textContent = current.difficulty[0].toUpperCase() + current.difficulty.slice(1);
    document.getElementById("diag-bar").style.width = (step / order.length) * 100 + "%";
    document.getElementById("diag-question").textContent = current.question;
    renderChoices(document.getElementById("diag-options"), current.options, i => { picked = i; nextBtn.disabled = false; });
    nextBtn.disabled = true;
    nextBtn.textContent = step === order.length - 1 ? "See my results" : "Next question";
  }

  function record() {
    if (picked === null) return;
    const correct = picked === current.correct;
    answers.push({ q: current, picked, correct });
    const s = state[current.topic];
    s.level = Math.max(0, Math.min(LEVELS.length - 1, s.level + (correct ? 1 : -1)));
    step++;
    ask();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function topicStats(code) {
    const list = answers.filter(a => a.q.topic === code);
    const earned = list.reduce((n, a) => n + (a.correct ? WEIGHT[a.q.difficulty] : 0), 0);
    const possible = list.reduce((n, a) => n + WEIGHT[a.q.difficulty], 0);
    return {
      list,
      correct: list.filter(a => a.correct).length,
      pct: possible ? Math.round((earned / possible) * 100) : 0,
      missed: list.filter(a => !a.correct),
      missedBasic: list.some(a => !a.correct && a.q.difficulty === "basic"),
      reachedAdvanced: list.some(a => a.q.difficulty === "advanced"),
      missedAdvanced: list.some(a => !a.correct && a.q.difficulty === "advanced")
    };
  }

  function results() {
    hide("diag-content"); show("diag-results");
    const box = document.getElementById("rec-content");
    box.innerHTML = "";

    const totalCorrect = answers.filter(a => a.correct).length;
    const pct = Math.round((totalCorrect / answers.length) * 100);

    const stats = topics.map(t => ({ t, ...topicStats(t.code) })).filter(x => x.list.length);
    stats.sort((a, b) => a.pct - b.pct || (b.t.testPoints || 0) - (a.t.testPoints || 0));

    const summary = el("div", "callout info");
    summary.append(el("h4", null, "Assessment summary"),
      el("p", null, `You answered ${totalCorrect} of ${answers.length} questions correctly (${pct}%).`));
    const weakest = stats.find(x => x.pct < 80);
    summary.append(el("p", null, weakest
      ? `Start with ${weakest.t.name}. Topics are listed from the one that needs the most work to the least.`
      : "Every topic looks strong. A light review of each one before the test is all you need."));
    box.append(summary);

    stats.forEach(x => {
      let cls, status, text;
      if (x.pct >= 80) { cls = "good"; status = "✅ Strong"; text = "You know this well. A quick review before the test is enough."; }
      else if (x.pct >= 60) { cls = "warn"; status = "⚠️ Review needed"; text = "Solid start. Review the flashcards and take the practice quiz for this topic to fill the gaps."; }
      else { cls = "bad"; status = "🎯 High priority"; text = "Make this a priority. Start with the flashcards for this topic, then take its practice quiz."; }
      if (x.missedBasic) text += " You missed a basic question, so begin with the key terms and definitions.";
      else if (x.missedAdvanced) text += " You know the basics. Focus on questions that compare similar ideas or ask which one does NOT fit.";
      else if (x.missed.length) text += " You know the key terms. Practice applying them to scenarios.";
      else if (x.pct >= 80 && x.reachedAdvanced) text += " You answered advanced questions correctly, too.";

      const card = el("div", "rec " + cls);
      const head = el("div", "rec-head");
      head.append(el("h4", null, x.t.name));
      const score = el("div", "rec-score", `${x.correct}/${x.list.length} correct`);
      score.append(el("small", null, status));
      head.append(score);
      card.append(head);
      if (x.t.testPoints) card.append(el("p", "rec-points", `About ${x.t.testPoints} points on the test`));
      card.append(el("p", null, text));

      const links = el("p", "rec-links");
      const f = el("a", null, "Study these flashcards"); f.href = "flashcards.html?topic=" + encodeURIComponent(x.t.code);
      const qz = el("a", null, "Take this topic's practice quiz"); qz.href = "quiz.html?topic=" + encodeURIComponent(x.t.code);
      links.append(f, qz);
      card.append(links);

      if (x.missed.length) {
        const det = el("details", "missed");
        det.append(el("summary", null, `Review the ${x.missed.length} question${x.missed.length === 1 ? "" : "s"} you missed`));
        x.missed.forEach(a => {
          const item = el("div", "missed-item");
          item.append(el("p", "missed-q", a.q.question));
          item.append(el("p", "missed-yours", "Your answer: " + a.q.options[a.picked]));
          item.append(el("p", "missed-right", "Correct answer: " + a.q.options[a.q.correct]));
          if (a.q.explanation) item.append(el("p", "missed-why", a.q.explanation));
          det.append(item);
        });
        card.append(det);
      }
      box.append(card);
    });

    const note = el("div", "callout warn");
    note.append(el("h4", null, "Don't forget the short answer"));
    const p = el("p", null, `The political cartoon question is worth ${SHORT_ANSWER_POINTS} points, and this check doesn't cover it. Review the `);
    const link = el("a", null, "POPES framework in the Study Guide"); link.href = "study-guide.html#popes";
    p.append(link, document.createTextNode(" and practice with the cartoons from class."));
    note.append(p);
    box.append(note);
    document.getElementById("diag-results").scrollIntoView({ block: "start" });
  }

  document.getElementById("start-btn").addEventListener("click", start);
  document.getElementById("retake-btn").addEventListener("click", start);
  nextBtn.addEventListener("click", record);
})();
