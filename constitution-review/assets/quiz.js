/* Practice quiz: pick a topic (or all topics), answer, check, and read the explanation. */
(async function () {
  const data = await loadSiteData();
  if (!data) return;

  let set = [], index = 0, score = 0, picked = null, chosenTopic = "all";

  const checkBtn = document.getElementById("check-btn");
  const nextBtn = document.getElementById("next-btn");
  const optionsBox = document.getElementById("quiz-options");

  // ----- Topic menu (built from topics that have quiz questions) -----
  const list = document.getElementById("topic-list");
  function addTopic(value, name, count, extraClass) {
    const label = document.createElement("label");
    label.className = "topic-option" + (extraClass ? " " + extraClass : "");
    label.innerHTML = `<input type="radio" name="topic"><span><span class="name"></span><span class="count"></span></span>`;
    const input = label.querySelector("input");
    input.value = value;
    if (value === "all") input.checked = true;
    label.querySelector(".name").textContent = name;
    label.querySelector(".count").textContent = `${count} question${count === 1 ? "" : "s"}`;
    list.appendChild(label);
  }
  addTopic("all", "All topics (mixed)", data.quiz.length, "all");
  data.topics.forEach(t => {
    const n = data.quiz.filter(q => q.topic === t.code).length;
    if (n) addTopic(t.code, t.name, n);
  });

  // Preselect a topic from a link like quiz.html?topic=preamble
  const wanted = new URLSearchParams(location.search).get("topic");
  const match = wanted && [...list.querySelectorAll("input")].find(i => i.value === wanted);
  if (match) match.checked = true;

  const topicLabel = code => code === "all" ? "All topics" : (data.topicNames[code] || code);

  function start() {
    chosenTopic = (list.querySelector("input:checked") || {}).value || "all";
    set = chosenTopic === "all"
      ? shuffle(data.quiz)
      : data.quiz.filter(q => q.topic === chosenTopic);
    index = 0; score = 0;
    hide("quiz-start"); hide("quiz-results"); show("quiz-content");
    render();
  }

  function render() {
    const q = set[index];
    picked = null;
    document.getElementById("quiz-progress").textContent = `Question ${index + 1} of ${set.length}`;
    document.getElementById("quiz-topic").textContent = data.topicNames[q.topic] || "";
    document.getElementById("quiz-score").textContent = `Score: ${score}/${index}`;
    document.getElementById("quiz-bar").style.width = (index / set.length) * 100 + "%";
    document.getElementById("quiz-question").textContent = q.question;
    renderChoices(optionsBox, q.options, i => { picked = i; checkBtn.disabled = false; });
    hide("quiz-feedback");
    checkBtn.classList.remove("hidden");
    checkBtn.disabled = true;
    nextBtn.classList.add("hidden");
  }

  function check() {
    if (picked === null) return;
    const q = set[index];
    const right = picked === q.correct;
    if (right) score++;

    [...optionsBox.children].forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correct) btn.classList.add("correct");
      else if (i === picked) btn.classList.add("wrong");
    });

    const fb = document.getElementById("quiz-feedback");
    fb.className = "callout " + (right ? "good" : "bad");
    document.getElementById("feedback-head").textContent = right
      ? "Correct!"
      : `Not quite. The answer is ${"ABCDEF"[q.correct]}: ${q.options[q.correct]}`;
    document.getElementById("feedback-text").textContent = q.explanation || "";

    document.getElementById("quiz-score").textContent = `Score: ${score}/${index + 1}`;
    document.getElementById("quiz-bar").style.width = ((index + 1) / set.length) * 100 + "%";
    checkBtn.classList.add("hidden");
    nextBtn.textContent = index === set.length - 1 ? "See results" : "Next question";
    nextBtn.classList.remove("hidden");
    nextBtn.focus();
  }

  function next() {
    if (index < set.length - 1) { index++; render(); }
    else results();
  }

  function results() {
    hide("quiz-content"); show("quiz-results");
    const pct = Math.round((score / set.length) * 100);
    document.getElementById("results-topic").textContent = topicLabel(chosenTopic);
    document.getElementById("final-score").textContent = `${score}/${set.length} (${pct}%)`;
    let feedback;
    if (pct >= 90) feedback = "Excellent! You're well prepared for this material!";
    else if (pct >= 80) feedback = "Great job! Review a few more concepts and you'll be ready!";
    else if (pct >= 70) feedback = "Good work! Spend some more time studying the questions you missed.";
    else feedback = "Keep studying! Try the flashcards and the Study Guide, then take this topic again.";
    document.getElementById("score-feedback").textContent = feedback;
  }

  function backToTopics() {
    hide("quiz-content"); hide("quiz-results"); show("quiz-start");
  }

  document.getElementById("start-btn").addEventListener("click", start);
  document.getElementById("retake-btn").addEventListener("click", start);
  document.getElementById("topics-btn").addEventListener("click", backToTopics);
  document.getElementById("quit-btn").addEventListener("click", backToTopics);
  checkBtn.addEventListener("click", check);
  nextBtn.addEventListener("click", next);
})();
