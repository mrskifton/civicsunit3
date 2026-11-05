/* Flashcards: choose a topic (or mixed), flip, move between cards,
   and remove cards you know. Removed cards stay out of that deck until
   the student puts them back or reloads the page. */
(async function () {
  const data = await loadSiteData();
  if (!data) return;

  const cards = data.flashcards;
  const select = document.getElementById("topic-select");
  const card = document.getElementById("flashcard");
  const qEl = document.getElementById("card-question");
  const aEl = document.getElementById("card-answer");
  const tagEl = document.getElementById("card-topic-front");
  const counter = document.getElementById("card-counter");
  const prevBtn = document.getElementById("prev-card");
  const nextBtn = document.getElementById("next-card");
  const removeBtn = document.getElementById("remove-card");
  const restoreBtn = document.getElementById("restore-cards");

  // Build the topic menu from topics that actually have cards
  data.topics.forEach(t => {
    if (!cards.some(c => c.topic === t.code)) return;
    const opt = document.createElement("option");
    opt.value = t.code;
    opt.textContent = "Topic: " + t.name;
    select.appendChild(opt);
  });

  // Open a topic from a link like flashcards.html?topic=preamble
  const wanted = new URLSearchParams(location.search).get("topic");
  if (wanted && [...select.options].some(o => o.value === wanted)) select.value = wanted;

  const removedByDeck = {};   // deck name -> Set of removed cards
  let deckCards = [];         // every card in the current deck (in study order)
  let set = [];               // cards still in the deck
  let index = 0;

  const removed = () => (removedByDeck[select.value] ||= new Set());

  function load() {
    const topic = select.value;
    deckCards = topic === "mixed" ? shuffle(cards) : cards.filter(c => c.topic === topic);
    set = deckCards.filter(c => !removed().has(c));
    index = 0;
    render();
  }

  function render() {
    card.classList.remove("flipped");
    const gone = removed().size;
    restoreBtn.textContent = `Put removed cards back (${gone})`;
    restoreBtn.classList.toggle("hidden", gone === 0);

    if (set.length === 0) {
      hide("card-area");
      if (deckCards.length === 0) {
        counter.textContent = "No cards for this topic yet.";
        hide("deck-done");
      } else {
        counter.textContent = `0 cards left, ${gone} removed`;
        show("deck-done");
      }
      return;
    }
    show("card-area"); hide("deck-done");

    const c = set[index];
    qEl.textContent = c.term;
    aEl.textContent = c.definition;
    tagEl.textContent = data.topicNames[c.topic] || "";
    counter.textContent = `Card ${index + 1} of ${set.length}` + (gone ? `, ${gone} removed` : "");
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === set.length - 1;
  }

  function flip() { if (set.length) card.classList.toggle("flipped"); }
  function prev() { if (index > 0) { index--; render(); } }
  function next() { if (index < set.length - 1) { index++; render(); } }

  function removeCurrent() {
    if (!set.length) return;
    removed().add(set[index]);
    set.splice(index, 1);
    if (index >= set.length) index = Math.max(0, set.length - 1);
    render();
  }

  function restore() {
    removed().clear();
    const current = set[index];
    set = [...deckCards];
    index = current ? set.indexOf(current) : 0;
    render();
  }

  select.addEventListener("change", load);
  card.addEventListener("click", flip);
  document.getElementById("flip-card").addEventListener("click", flip);
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  removeBtn.addEventListener("click", removeCurrent);
  restoreBtn.addEventListener("click", restore);

  document.addEventListener("keydown", e => {
    const tag = e.target.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "r" || e.key === "R") removeCurrent();
    else if (e.key === " " && tag !== "BUTTON") { e.preventDefault(); flip(); }
  });

  load();
})();
