# Niyam Sahayak: backend API

> **Where this lives:** the `backend/` folder of the `niyam-sahayak-frontend` repo, which is **public**.
> Don't commit anything here you wouldn't publish, and never commit the Gemini key.
> On Render, set **Root directory** to `backend`.

The Colab brain, turned into a small web API the dashboard can call.
It answers only from your documents and returns the page and quote for every answer.

## 1. Put the files in place

```
backend/
├── main.py
├── requirements.txt
└── data/
    ├── vectors.npy        ← from Google Drive: Niyam-Sahayak/index/
    ├── chunks.json        ← from Google Drive: Niyam-Sahayak/index/
    ├── documents.json     ← edit this: one entry per PDF (see below)
    └── docs/              ← copy the same PDFs from Drive: Niyam-Sahayak/docs/
        └── *.pdf
```

`vectors.npy` and `chunks.json` must come from the **same** REBUILD INDEX run.
If you add or remove PDFs: rebuild in Colab, then replace both files here.

### documents.json (what each PDF is)

One entry per PDF. The `file` name must match the PDF file name exactly.

| Field | Meaning | Example |
| --- | --- | --- |
| `title` | Name shown in the dashboard | `"Dearness Allowance order: 46% to 50%"` |
| `number` | Order or circular number | `"FMA.4/2024/12"` |
| `date` | Date issued, `YYYY-MM-DD` | `"2024-01-01"` |
| `department` | Issuing department | `"Finance"` |
| `type` | Rules / Order / Circular / Report | `"Order"` |
| `library` | `"common"` (everyone) or a department (`"assac"`, `"aasc"`) | `"common"` |
| `status` | `"in_force"` or `"superseded"` | `"superseded"` |
| `replaced_by` | For superseded docs: the file that replaced it | `"DA_Order_46_to_50_wef_2024.pdf"` |

Open each PDF and fill in the real number and date. A PDF missing from this file still works,
with defaults: library common, status in force.

Superseded documents are **left out of answers by default**. The answer then lists the
older orders it replaces, which is the "superseded" demo.

## 2. Run it on your laptop (optional, to test)

```bash
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY="your-key"          # needed for search (embeddings)
export ANTHROPIC_API_KEY="your-key"       # optional: Claude writes the answers
uvicorn main:app --reload
```

Open http://localhost:8000/docs. Every endpoint can be tried there with the **Try it out** button.

## 3. Put it online (Render, free)

1. Push the `backend` folder to a **private** GitHub repo (PDFs and index files included).
   Never commit the API key.
2. Go to render.com → **New → Web Service** → connect the repo.
3. Settings:
   - **Root directory:** `backend` (if the repo has other folders)
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance type:** Free
4. **Environment → Add variable:** `GEMINI_API_KEY` = your key.
5. **Deploy.** When it's live, open `https://<your-app>.onrender.com/health`.
   You should see `"status": "ok"` and your document and piece counts.

Give Tushar / the dashboard this URL as `NEXT_PUBLIC_API_URL`.

**Free-tier note:** Render puts the app to sleep after ~15 minutes idle, and the first request
then takes ~50 seconds. Open `/health` a minute before any demo or recording.
Logs are kept in memory and reset when the app restarts. That's fine for the demo.

## 4. Endpoints (what the dashboard calls)

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | Is it alive, how many documents |
| GET | `/documents?department=assac` | Library list with title, date, status, `replaces` |
| GET | `/documents/{file}/file` | The original PDF, for the viewer |
| POST | `/ask` | Question → answer + citations (page + exact quote) |
| GET | `/templates` | Draft templates and their fields |
| POST | `/draft` | Fill a leave sanction order, rule reference cited |
| POST | `/summarise` | Summary + key details table for one document |
| POST | `/feedback` | Thumbs up / down / report on an answer |
| GET | `/logs` | Recent questions and feedback (admin view) |

### Example: `/ask`

Request:
```json
{ "question": "What is the current DA rate?", "department": "assac" }
```
Response:
```json
{
  "question": "What is the current DA rate?",
  "language": "English",
  "found": true,
  "answer": "Dearness allowance is 50% with effect from 1.1.2024 [1].",
  "citations": [
    { "n": 1, "document": "DA_Order_46_to_50_wef_2024.pdf", "title": "Dearness Allowance order: 46% to 50%",
      "number": "", "date": "2024-01-01", "status": "in_force", "page": 1,
      "quote": "enhanced from 46 percent to 50 percent with effect from 1.1.2024" }
  ],
  "replaces": [
    { "document": "DA_Order_42_to_46.pdf", "title": "Dearness Allowance order: 42% to 46%",
      "number": "", "date": "", "status": "superseded" }
  ],
  "latency_ms": 2400,
  "log_id": "a1b2c3d4e5"
}
```
When nothing supports an answer: `"found": false` and `"answer": "Not found in approved documents."`
Questions typed in Assamese are answered in Assamese (`"language": "Assamese"`); quotes stay in the document's language.

## Safety built in

- Answers only from the retrieved pieces; strict "not found" rule.
- **Source check:** every quote must really appear in the cited piece, or the answer is blocked.
- Summary details are marked `"verified": true` only if the value is found on the page given.
- Drafts never invent a rule. If none is found, the draft says so in brackets.
- Every question, draft and summary is logged.

## Settings (optional environment variables)

| Name | Default |
| --- | --- |
| `ANTHROPIC_API_KEY` | (unset) - when set, Claude writes answers, drafts and summaries; Gemini becomes the fallback |
| `ANSWER_MODEL` | `claude-opus-5-5` |
| `ANSWER_EFFORT` | `low` (`low`/`medium`/`high`; higher = slower, more thorough) |
| `GEN_MODEL` | `gemini-3.8-flash` (Gemini fallback, or main model without a Claude key) |
| `GEN_FALLBACK_MODELS` | `gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash` |
| `EMBED_MODEL` | `gemini-embedding-001` (must match the one used in Colab) |
| `TOP_K` | `5` |
| `ALLOWED_ORIGINS` | `*` (set to your Vercel URL before sharing widely) |
