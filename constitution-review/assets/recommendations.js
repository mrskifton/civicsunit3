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
    stats.forEach(x => {
      if (x.pct >= 80) { x.cls = "good"; x.status = "Strong"; }
      else if (x.pct >= 60) { x.cls = "warn"; x.status = "Review needed"; }
      else { x.cls = "bad"; x.status = "High priority"; }
    });

    // Overall score
    const head = el("div", "results-head");
    head.append(el("p", "score-big", `${totalCorrect}/${answers.length}`));
    const weakest = stats.find(x => x.pct < 80);
    head.append(el("p", null, `${pct}% correct. ` + (weakest
      ? `Start with ${weakest.t.name}.`
      : "Every topic looks strong. A light review before the test is all you need.")));
    box.append(head);

    // At a glance: one bar per topic, weakest first
    const glance = el("div", "glance");
    glance.append(el("h4", null, "Your topics at a glance"));
    stats.forEach(x => {
      const row = el("a", "glance-row");
      row.href = "#rec-" + x.t.code;
      row.append(el("span", "glance-name", x.t.name));
      const bar = el("span", "glance-bar");
      const fill = el("span", "lvl-" + x.cls);
      fill.style.width = Math.max(4, x.pct) + "%";
      bar.append(fill);
      row.append(bar, el("span", "glance-num", `${x.correct}/${x.list.length}`));
      row.setAttribute("aria-label", `${x.t.name}: ${x.correct} of ${x.list.length} correct, ${x.status}`);
      glance.append(row);
    });
    glance.append(el("p", "why", "Bars count harder questions more, so they can differ a little from the number correct."));
    box.append(glance);

    // One card per topic
    stats.forEach(x => {
      let text;
      if (x.cls === "good") text = "You know this well. A quick review before the test is enough.";
      else if (x.cls === "warn") text = "Solid start. Review the flashcards and take the practice quiz for this topic to fill the gaps.";
      else text = "Make this a priority. Start with the flashcards for this topic, then take its practice quiz.";
      if (x.missedBasic) text += " You missed a basic question, so begin with the key terms and definitions.";
      else if (x.missedAdvanced) text += " You know the basics. Focus on questions that compare similar ideas or ask which one does NOT fit.";
      else if (x.missed.length) text += " You know the key terms. Practice applying them to scenarios.";
      else if (x.cls === "good" && x.reachedAdvanced) text += " You answered advanced questions correctly, too.";

      const card = el("section", "rec " + x.cls);
      card.id = "rec-" + x.t.code;
      const top = el("div", "rec-head");
      const left = el("div");
      left.append(el("h3", null, x.t.name), el("span", "pill " + x.cls, x.status));
      const score = el("div", "rec-score");
      score.append(el("div", "num", `${x.correct}/${x.list.length}`), el("div", "lbl", "correct"));
      top.append(left, score);
      card.append(top);

      const chips = el("div", "chips");
      if (x.t.testPoints) chips.append(el("span", "chip", `About ${x.t.testPoints} points on the test`));
      if (x.missed.length) chips.append(el("span", "chip", `${x.missed.length} missed`));
      if (chips.children.length) card.append(chips);
      card.append(el("p", "rec-text", text));

      const actions = el("div", "rec-actions");
      const f = el("a", "btn" + (x.cls === "good" ? " secondary" : ""), "Study the flashcards");
      f.href = "flashcards.html?topic=" + encodeURIComponent(x.t.code);
      const qz = el("a", "btn secondary", "Take the practice quiz");
      qz.href = "quiz.html?topic=" + encodeURIComponent(x.t.code);
      actions.append(f, qz);
      card.append(actions);

      if (x.missed.length) {
        const det = el("details", "missed");
        if (x.cls === "bad") det.open = true;
        det.append(el("summary", null, `Review the ${x.missed.length} question${x.missed.length === 1 ? "" : "s"} you missed`));
        x.missed.forEach((a, i) => {
          const item = el("div", "missed-item");
          const qline = el("p", "missed-q");
          qline.append(el("span", "n", String(i + 1)), el("span", null, a.q.question));
          item.append(qline);
          const yours = el("div", "ans yours");
          yours.append(el("span", "tag", "✗ Your answer"), el("span", null, a.q.options[a.picked]));
          const right = el("div", "ans right");
          right.append(el("span", "tag", "✓ Correct answer"), el("span", null, a.q.options[a.q.correct]));
          item.append(yours, right);
          if (a.q.explanation) {
            const why = el("p", "why");
            why.append(el("strong", null, "Why: "), document.createTextNode(a.q.explanation));
            item.append(why);
          }
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
