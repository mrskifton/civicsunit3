/* Study Recommendations: an adaptive check that finds weak topics.
   How it works (same rules as the original site):
   - It asks about the topic with the fewest questions so far.
   - Everyone starts on "basic". After 2 questions in a topic, 80%+ correct moves
     to "advanced" and 60%+ moves to "intermediate".
   - A topic is finished after at least 3 questions with 80%+ correct, or after 6 questions
     (MAX_PER_TOPIC), or when it runs out of questions.
   - When every topic is finished, results are shown, weakest topic first. */
(async function () {
  const data = await loadSiteData();
  if (!data) return;

  const MAX_PER_TOPIC = 6;
  const MIN_FOR_CONFIDENCE = 3;

  const topics = data.topics.map(t => t.code).filter(code => data.diagnostic.some(q => q.topic === code));
  let pool, mastery, answers, current, picked, count;

  const nextBtn = document.getElementById("diag-next");

  function start() {
    pool = [...data.diagnostic];
    mastery = {};
    topics.forEach(t => { mastery[t] = { correct: 0, total: 0, done: false }; });
    answers = []; count = 0;
    hide("diag-start"); hide("diag-results"); show("diag-content");
    ask();
  }

  function nextQuestion() {
    const open = topics.filter(t => !mastery[t].done && mastery[t].total < MAX_PER_TOPIC);
    // A topic with no questions left counts as finished
    open.forEach(t => { if (!pool.some(q => q.topic === t)) mastery[t].done = true; });
    const ready = open.filter(t => !mastery[t].done);
    if (!ready.length) return null;

    ready.sort((a, b) => mastery[a].total - mastery[b].total);
    const topic = ready[0];
    const m = mastery[topic];

    let level = "basic";
    if (m.total >= 2) {
      const acc = m.correct / m.total;
      if (acc >= 0.8) level = "advanced";
      else if (acc >= 0.6) level = "intermediate";
    }
    return pool.find(q => q.topic === topic && q.difficulty === level)
        || pool.find(q => q.topic === topic);
  }

  function ask() {
    current = nextQuestion();
    if (!current) return results();
    pool.splice(pool.indexOf(current), 1);
    picked = null;
    count++;

    document.getElementById("diag-progress").textContent = `Question ${count}`;
    document.getElementById("diag-topic").textContent =
      `${data.topicNames[current.topic] || current.topic} (${current.difficulty})`;
    const finished = topics.filter(t => mastery[t].done).length;
    document.getElementById("diag-bar").style.width = (finished / topics.length) * 100 + "%";
    document.getElementById("diag-question").textContent = current.question;
    renderChoices(document.getElementById("diag-options"), current.options, i => {
      picked = i; nextBtn.disabled = false;
    });
    nextBtn.disabled = true;
  }

  function record() {
    if (picked === null) return;
    const correct = picked === current.correct;
    answers.push({ question: current, correct });
    const m = mastery[current.topic];
    m.total++;
    if (correct) m.correct++;
    if (m.total >= MIN_FOR_CONFIDENCE) {
      m.done = m.correct / m.total >= 0.8 || m.total >= MAX_PER_TOPIC;
    }
    ask();
  }

  function breakdown(topic) {
    const tally = { basic: [0, 0], intermediate: [0, 0], advanced: [0, 0] };
    answers.filter(a => a.question.topic === topic).forEach(a => {
      const t = tally[a.question.difficulty] || (tally[a.question.difficulty] = [0, 0]);
      t[1]++; if (a.correct) t[0]++;
    });
    const tips = [];
    if (tally.basic[1] && tally.basic[0] / tally.basic[1] < 0.8) tips.push("Focus on basic concepts first");
    if (tally.intermediate[1] && tally.intermediate[0] / tally.intermediate[1] < 0.7) tips.push("practice intermediate applications");
    if (tally.advanced[1] && tally.advanced[0] / tally.advanced[1] < 0.6) tips.push("work on advanced analysis questions");
    return tips.length ? ` Specifically: ${tips.join(", ")}.` : "";
  }

  function results() {
    hide("diag-content"); show("diag-results");
    const box = document.getElementById("rec-content");
    box.innerHTML = "";

    const totalCorrect = answers.filter(a => a.correct).length;
    const overall = answers.length ? Math.round((totalCorrect / answers.length) * 100) : 0;
    const summary = document.createElement("div");
    summary.className = "callout info";
    summary.innerHTML = `<h4>Assessment summary</h4>
      <p>You answered ${totalCorrect} out of ${answers.length} questions correctly (${overall}%).</p>
      <p style="color:var(--muted); font-size:0.95rem">The questions adapted to your answers to find your strengths and the areas to work on.</p>`;
    box.appendChild(summary);

    const acc = t => mastery[t].total ? mastery[t].correct / mastery[t].total : 0;
    [...topics].sort((a, b) => acc(a) - acc(b)).forEach(t => {
      const m = mastery[t];
      if (!m.total) return;
      const pct = Math.round(acc(t) * 100);
      let cls, text, status;
      if (pct >= 80) { cls = "good"; status = "✅ Strong"; text = "Excellent understanding! Light review recommended."; }
      else if (pct >= 60) { cls = "warn"; status = "⚠️ Review needed"; text = "Good foundation. Review key concepts and practice more questions."; }
      else { cls = "bad"; status = "🎯 High priority"; text = "Priority study area. Focus significant time here using flashcards and practice."; }
      text += breakdown(t);

      const div = document.createElement("div");
      div.className = "rec " + cls;
      div.innerHTML = `<div class="rec-head"><h4></h4>
        <div class="rec-score">${m.correct}/${m.total} (${pct}%)<small>${status}</small></div></div><p></p>`;
      div.querySelector("h4").textContent = data.topicNames[t] || t;
      div.querySelector("p").textContent = text;
      box.appendChild(div);
    });
  }

  document.getElementById("start-btn").addEventListener("click", start);
  document.getElementById("retake-btn").addEventListener("click", start);
  nextBtn.addEventListener("click", record);
})();
