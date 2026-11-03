/* Flashcards: choose a topic (or mixed), flip, previous/next. */
(async function () {
  const data = await loadSiteData();
  if (!data) return;

  const select = document.getElementById("topic-select");
  const card = document.getElementById("flashcard");
  const qEl = document.getElementById("card-question");
  const aEl = document.getElementById("card-answer");
  const tagEl = document.getElementById("card-topic-front");
  const counter = document.getElementById("card-counter");
  const prevBtn = document.getElementById("prev-card");
  const nextBtn = document.getElementById("next-card");

  // Build the topic menu from topics that actually have cards
  data.topics.forEach(t => {
    if (!data.flashcards.some(c => c.topic === t.code)) return;
    const opt = document.createElement("option");
    opt.value = t.code;
    opt.textContent = "Topic: " + t.name;
    select.appendChild(opt);
  });

  let set = [];
  let index = 0;

  function load() {
    const topic = select.value;
    set = topic === "mixed"
      ? shuffle(data.flashcards)
      : data.flashcards.filter(c => c.topic === topic);
    index = 0;
    render();
  }

  function render() {
    card.classList.remove("flipped");
    if (set.length === 0) {
      counter.textContent = "No cards for this topic yet.";
      qEl.textContent = ""; aEl.textContent = "";
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }
    const c = set[index];
    qEl.textContent = c.question;
    aEl.textContent = c.answer;
    tagEl.textContent = data.topicNames[c.topic] || "";
    counter.textContent = `Card ${index + 1} of ${set.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === set.length - 1;
  }

  function flip() { if (set.length) card.classList.toggle("flipped"); }
  function prev() { if (index > 0) { index--; render(); } }
  function next() { if (index < set.length - 1) { index++; render(); } }

  select.addEventListener("change", load);
  card.addEventListener("click", flip);
  document.getElementById("flip-card").addEventListener("click", flip);
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  document.addEventListener("keydown", e => {
    const tag = e.target.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
    else if (e.key === " " && tag !== "BUTTON") { e.preventDefault(); flip(); }
  });

  load();
})();
