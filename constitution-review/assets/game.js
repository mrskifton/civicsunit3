/* Constitutional Cases Game: 10 scenarios per round, 3 lives, 10 points per correct answer. */
(async function () {
  const data = await loadSiteData();
  if (!data) return;

  const ROUND_LENGTH = 10;
  const STARTING_LIVES = 3;
  const POINTS = 10;

  // How each amendment is labeled on the answer buttons.
  // Scenarios can use any amendment; ones not listed here just show "Nth Amendment".
  const AMENDMENT_LABELS = {
    "1st": "Freedom of speech, religion, press, assembly, petition",
    "2nd": "Right to bear arms",
    "3rd": "No quartering of soldiers",
    "4th": "Protection against unreasonable searches",
    "5th": "Due process, self-incrimination, double jeopardy",
    "6th": "Right to speedy trial and counsel",
    "7th": "Jury trial in civil cases",
    "8th": "No excessive bail or cruel punishment",
    "9th": "Rights not listed still belong to the people",
    "10th": "Powers not given to the federal government belong to states or the people"
  };
  const label = a => AMENDMENT_LABELS[a] ? `${a} Amendment (${AMENDMENT_LABELS[a]})` : `${a} Amendment`;

  // Group scenarios by amendment
  const byAmendment = {};
  data.gameScenarios.forEach(s => (byAmendment[s.amendment] ||= []).push(s));
  const amendments = Object.keys(byAmendment);
  const roundSize = Math.min(ROUND_LENGTH, data.gameScenarios.length);

  document.getElementById("rules").innerHTML = `
    <li>${roundSize} scenarios per round, different ones each time</li>
    <li>You have ${STARTING_LIVES} lives. Lose them all and the game ends.</li>
    <li>Each correct answer earns ${POINTS} points</li>
    <li>Choose the most relevant amendment from 4 options</li>
    <li>There are ${data.gameScenarios.length} scenarios in the library, so every game is a little different</li>`;

  let round = [], index = 0, score = 0, lives = STARTING_LIVES, picked = null, answered = false;

  const submitBtn = document.getElementById("submit-btn");
  const optionsBox = document.getElementById("game-options");

  // Pick a random amendment, then a random unused scenario for it (keeps amendments balanced, no repeats)
  function buildRound() {
    const used = new Set();
    const out = [];
    while (out.length < roundSize) {
      const open = amendments.filter(a => byAmendment[a].some(s => !used.has(s)));
      if (!open.length) break;
      const a = open[Math.floor(Math.random() * open.length)];
      const choices = byAmendment[a].filter(s => !used.has(s));
      const s = choices[Math.floor(Math.random() * choices.length)];
      used.add(s);
      out.push(s);
    }
    return shuffle(out);
  }

  function start() {
    round = buildRound();
    index = 0; score = 0; lives = STARTING_LIVES;
    hide("game-start"); hide("game-end"); show("game-content");
    loadScenario();
  }

  function updateStats() {
    document.getElementById("game-score").textContent = score;
    document.getElementById("game-qnum").textContent = `${index + 1}/${round.length}`;
    document.getElementById("game-lives").textContent =
      "❤️".repeat(lives) + "💔".repeat(STARTING_LIVES - lives);
    document.getElementById("game-lives").setAttribute("aria-label", `${lives} lives left`);
  }

  function loadScenario() {
    const s = round[index];
    picked = null; answered = false;
    document.getElementById("game-scenario").textContent = s.scenario;

    const wrong = shuffle(amendments.filter(a => a !== s.amendment)).slice(0, 3);
    const opts = shuffle([s.amendment, ...wrong]);
    renderChoices(optionsBox, opts.map(label), i => { picked = opts[i]; submitBtn.disabled = false; });
    optionsBox.dataset.opts = JSON.stringify(opts);

    hide("game-feedback");
    submitBtn.classList.remove("hidden");
    submitBtn.disabled = true;
    updateStats();
  }

  function submit() {
    if (!picked || answered) return;
    answered = true;
    const s = round[index];
    const correct = picked === s.amendment;
    if (correct) score += POINTS; else lives--;

    const opts = JSON.parse(optionsBox.dataset.opts);
    [...optionsBox.children].forEach((btn, i) => {
      btn.disabled = true;
      if (opts[i] === s.amendment) btn.classList.add("correct");
      else if (opts[i] === picked) btn.classList.add("wrong");
    });

    const fb = document.getElementById("game-feedback");
    fb.className = "callout " + (correct ? "good" : "bad");
    document.getElementById("feedback-head").textContent = correct ? `Correct! +${POINTS} points` : "Incorrect. −1 life";
    const fc = document.getElementById("feedback-correct");
    fc.textContent = correct ? "" : `The correct answer is the ${s.amendment} Amendment.`;
    fc.classList.toggle("hidden", correct);
    document.getElementById("feedback-explain").textContent = s.explanation;

    const lastOne = index >= round.length - 1;
    document.getElementById("continue-btn").textContent =
      lives <= 0 ? "See final score" : lastOne ? "Finish game" : "Next scenario";

    submitBtn.classList.add("hidden");
    updateStats();
    document.getElementById("continue-btn").focus();
  }

  function next() {
    if (lives <= 0) return end(false);
    index++;
    if (index >= round.length) return end(true);
    loadScenario();
  }

  function end(completed) {
    hide("game-content"); show("game-end");
    document.getElementById("end-title").textContent = completed ? "Congratulations!" : "Game over!";
    document.getElementById("end-sub").textContent = completed ? "You've completed all the scenarios!" : "You ran out of lives.";
    document.getElementById("end-score").textContent = score;
    let perf = "";
    if (completed) {
      const pct = Math.round((score / (round.length * POINTS)) * 100);
      if (pct >= 90) perf = "Outstanding! You have excellent understanding of the Bill of Rights!";
      else if (pct >= 80) perf = "Great job! You have strong knowledge of constitutional rights.";
      else if (pct >= 70) perf = "Good work! Review the scenarios you missed to improve further.";
      else perf = "Keep practicing! Use the flashcards to strengthen your understanding.";
    }
    document.getElementById("end-performance").textContent = perf;
  }

  document.getElementById("start-btn").addEventListener("click", start);
  document.getElementById("again-btn").addEventListener("click", start);
  submitBtn.addEventListener("click", submit);
  document.getElementById("continue-btn").addEventListener("click", next);
})();
