# Constitution Test Review site

## What's in the folder

```
index.html                 Home page
flashcards.html            Flashcards
quiz.html                  Practice quiz
game.html                  Constitutional Cases game
recommendations.html       Study Recommendations (adaptive check)
study-guide.html           Study guide (edit this page directly; it isn't data-driven)
converter.html             Teacher tool: CSV → data.json (not linked in the menu)

assets/style.css           All colors and fonts (see the :root block at the top)
assets/site.js             Header, menu, footer, and data loading for every page
assets/*.js                One script per activity, plus converter-core.js

data/data.json             Everything the activities read
data/csv/                  The editable CSV versions of data.json
```

## Updating the material

1. Edit a CSV in Excel or Google Sheets. Save/download it as CSV.
2. Open `converter.html` on your site and drop in the CSVs you changed.
   Sections you don't upload are kept from the current `data.json`.
3. Download `data.json` and replace `data/data.json`.

Command-line alternative (needs Node.js): `node assets/converter-core.js data/csv data/data.json`

## CSV columns

| File | Columns |
|---|---|
| topics.csv | `topic_code` (one word, used in the other files), `topic_name` (what students see) |
| flashcards.csv | `topic`, `question`, `answer` |
| quiz.csv | `question`, `option_a`–`option_d`, `correct_answer` (A–D), `topic` |
| game_scenarios.csv | `amendment` (1st, 4th… or just 1, 4), `scenario`, `explanation` |
| study_recommendations.csv | `topic`, `difficulty` (basic / intermediate / advanced), `question`, `option_a`–`option_d`, `correct_answer` |

- Questions can have 2–4 options; leave unused option columns blank.
- Questions are asked in the order they appear in the file.
- Study Recommendations asks up to 6 questions per topic, so 2 per difficulty level is enough.

## Testing on your computer

Pages load `data/data.json`, which browsers block when you double-click an HTML file
(`file://`). Use VS Code's Live Server extension, or run `python -m http.server`
in this folder and visit http://localhost:8000.
