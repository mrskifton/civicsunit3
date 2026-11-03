/* Practice quiz: answer every question, move back and forth, see your score at the end. */
(async function () {
  const data = await loadSiteData();
  if (!data) return;

  const questions = data.quiz;
  let index = 0;
  let answers = [];

  const nextBtn = document.getElementById("quiz-next");
  const prevBtn = document.getElementById("quiz-prev");

  document.getElementById("quiz-intro").textContent =
    `Test your knowledge with ${questions.length} questions covering all Constitution topics.`;

  function scoreThrough(n) {
    let s = 0;
    for (let i = 0; i < n; i++) if (answers[i] === questions[i].correct) s++;
    return s;
  }

  function start() {
    index = 0;
    answers = new Array(questions.length).fill(null);
    hide("quiz-start"); hide("quiz-results"); show("quiz-content");
    render();
  }

  function render() {
    const q = questions[index];
    document.getElementById("quiz-progress").textContent = `Question ${index + 1} of ${questions.length}`;
    document.getElementById("quiz-score").textContent = `Score: ${scoreThrough(index)}/${index}`;
    document.getElementById("quiz-bar").style.width = ((index + 1) / questions.length) * 100 + "%";
    document.getElementById("quiz-question").textContent = q.question;

    const box = document.getElementById("quiz-options");
    renderChoices(box, q.options, i => { answers[index] = i; nextBtn.disabled = false; });
    if (answers[index] !== null) {
      box.children[answers[index]].setAttribute("aria-pressed", "true");
    }
    prevBtn.disabled = index === 0;
    nextBtn.disabled = answers[index] === null;
    nextBtn.textContent = index === questions.length - 1 ? "Finish quiz" : "Next";
  }

  function next() {
    if (answers[index] === null) return;
    if (index < questions.length - 1) { index++; render(); }
    else results();
  }

  function prev() { if (index > 0) { index--; render(); } }

  function results() {
    hide("quiz-content"); show("quiz-results");
    const score = scoreThrough(questions.length);
    const pct = Math.round((score / questions.length) * 100);
    document.getElementById("final-score").textContent = `${score}/${questions.length} (${pct}%)`;
    let feedback;
    if (pct >= 90) feedback = "Excellent! You're well prepared for the test!";
    else if (pct >= 80) feedback = "Great job! Review a few more concepts and you'll be ready!";
    else if (pct >= 70) feedback = "Good work! Spend some more time studying the areas you missed.";
    else feedback = "Keep studying! Use the flashcards and Study Recommendations to improve.";
    document.getElementById("score-feedback").textContent = feedback;
  }

  document.getElementById("start-btn").addEventListener("click", start);
  document.getElementById("retake-btn").addEventListener("click", start);
  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);
})();
