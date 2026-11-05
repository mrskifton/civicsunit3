/* ==========================================================
   Shared code used by every page.
   - Builds the header, nav, and footer (edit NAV_LINKS to change the menu)
   - Loads data/data.json
   - Small helpers (shuffle, topic names)
   ========================================================== */

const SITE_TITLE = "Constitution Test Review";

const NAV_LINKS = [
  { href: "index.html", label: "Home" },
  { href: "flashcards.html", label: "Flashcards" },
  { href: "quiz.html", label: "Practice Quiz" },
  { href: "game.html", label: "Cases Game" },
  { href: "recommendations.html", label: "Study Recommendations" },
  { href: "study-guide.html", label: "Study Guide" }
];

(function buildChrome() {
  const here = location.pathname.split("/").pop() || "index.html";

  const header = document.createElement("header");
  header.className = "site-header";
  const links = NAV_LINKS.map(l =>
    `<a href="${l.href}"${l.href === here ? ' aria-current="page"' : ""}>${l.label}</a>`
  ).join("");
  header.innerHTML = `
    <div class="inner">
      <a class="site-name" href="index.html">${SITE_TITLE}</a>
      <nav class="site-nav" aria-label="Main">${links}</nav>
    </div>`;
  const bunting = document.createElement("div");
  bunting.className = "bunting";
  bunting.setAttribute("aria-hidden", "true");
  document.body.prepend(header, bunting);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.textContent = "Civics, Unit 3: The Constitution";
  document.body.append(footer);
})();

/* Load the site data. Every activity page calls this. */
async function loadSiteData() {
  try {
    const res = await fetch("data/data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    data.topicNames = {};
    (data.topics || []).forEach(t => { data.topicNames[t.code] = t.name; });
    return data;
  } catch (err) {
    console.error(err);
    const main = document.querySelector("main");
    const box = document.createElement("div");
    box.className = "load-error";
    box.innerHTML = `<h3>The study material didn't load</h3>
      <p>This page reads its questions from <code>data/data.json</code>. Check that the file
      is in the <code>data</code> folder next to this page. If you opened the page straight
      from your computer (the address starts with <code>file://</code>), open it through a
      web server instead, such as your hosted site or VS Code's Live Server.</p>`;
    main.prepend(box);
    return null;
  }
}

/* Returns a shuffled copy of an array (Fisher–Yates). */
function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Builds the A/B/C/D answer buttons used by the quiz and study check. */
function renderChoices(container, options, onPick) {
  container.innerHTML = "";
  options.forEach((text, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.setAttribute("aria-pressed", "false");
    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = "ABCDEF"[i];
    const label = document.createElement("span");
    label.textContent = text;
    b.append(letter, label);
    b.addEventListener("click", () => {
      container.querySelectorAll(".choice").forEach(c => c.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      onPick(i);
    });
    container.appendChild(b);
  });
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }
