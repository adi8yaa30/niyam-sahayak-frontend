"""
Niyam Sahayak - backend API (MVP)

Answers questions ONLY from approved documents, with page-level citations.
Uses the index built in Colab (data/vectors.npy + data/chunks.json).

Run locally:   uvicorn main:app --reload
Docs:          http://localhost:8000/docs
"""

import os
import re
import json
import time
import uuid
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# ---------------------------------------------------------------- settings

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent / "data"))
DOCS_DIR = DATA_DIR / "docs"
EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
GEN_MODEL = os.getenv("GEN_MODEL", "gemini-3.8-flash")
# Tried in order when the main model is busy (503), rate-limited (429) or not available to this key (404).
GEN_FALLBACK_MODELS = [m.strip() for m in os.getenv(
    "GEN_FALLBACK_MODELS", "gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash").split(",") if m.strip()]
GEN_MODELS = list(dict.fromkeys([GEN_MODEL, *GEN_FALLBACK_MODELS]))
# Claude writes the answers when ANTHROPIC_API_KEY is set; Gemini (above) is the fallback and does the embeddings.
CLAUDE_MODEL = os.getenv("ANSWER_MODEL", "claude-opus-5-5")
CLAUDE_EFFORT = os.getenv("ANSWER_EFFORT", "low")          # low keeps answers within a few seconds
USE_CLAUDE = bool(os.getenv("ANTHROPIC_API_KEY"))
TOP_K = int(os.getenv("TOP_K", "5"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

NOT_FOUND = "Not found in approved documents."

# ---------------------------------------------------------------- Gemini client

_client = None


def gemini():
    """Create the Gemini client on first use (keeps the key out of the code)."""
    global _client
    if _client is None:
        from google import genai
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(api_key=key)
    return _client


def with_retry(fn, tries=4):
    """Retry when Gemini is busy (503) or rate-limited (429)."""
    for attempt in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if ("503" in msg or "429" in msg) and attempt < tries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            raise


def embed(texts, task):
    from google.genai import types
    vectors = []
    for i in range(0, len(texts), 20):
        batch = texts[i:i + 20]
        res = with_retry(lambda: gemini().models.embed_content(
            model=EMBED_MODEL, contents=batch,
            config=types.EmbedContentConfig(task_type=task)))
        vectors += [e.values for e in res.embeddings]
    v = np.array(vectors, dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


class ModelBusy(Exception):
    """Every generation model was busy or unavailable."""


SKIP_MODEL = ("503", "429", "404", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "NOT_FOUND")


def generate(config, contents):
    """Generate with GEN_MODEL; if it is busy or unavailable, fall back to the next model."""
    last = None
    for model in GEN_MODELS:
        try:
            return with_retry(lambda: gemini().models.generate_content(
                model=model, contents=contents, config=config), tries=2)
        except Exception as e:  # noqa: BLE001
            if any(code in str(e) for code in SKIP_MODEL):
                print(f"[gen] {model} unavailable, trying next: {str(e)[:120]}", flush=True)
                last = e
                continue
            raise
    raise ModelBusy(str(last))


_claude = None


def claude():
    """Create the Anthropic client on first use (reads ANTHROPIC_API_KEY)."""
    global _claude
    if _claude is None:
        import anthropic
        _claude = anthropic.Anthropic(timeout=60.0, max_retries=2)
    return _claude


def claude_generate(prompt, system=None, schema=None):
    """One Claude call. Returns the text of the reply (valid JSON when a schema is given)."""
    output_config = {"effort": CLAUDE_EFFORT}
    if schema:
        output_config["format"] = {"type": "json_schema", "schema": schema}
    kwargs = {"system": system} if system else {}
    res = claude().beta.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=16000,
        output_config=output_config,
        # On a safety decline, the API re-runs the request on a suitable model inside the same call.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": prompt}],
        **kwargs,
    )
    if res.stop_reason == "refusal":
        raise RuntimeError("Claude declined the request")
    text = "".join(b.text for b in res.content if b.type == "text").strip()
    if not text:
        raise RuntimeError(f"Claude returned no text (stop_reason={res.stop_reason})")
    return text


def with_claude_first(claude_call, gemini_call):
    """Use Claude when configured; on any Claude failure, fall back to Gemini."""
    if USE_CLAUDE:
        try:
            return claude_call()
        except Exception as e:  # noqa: BLE001 - any failure here should fall back, not fail the officer
            print(f"[claude] {CLAUDE_MODEL} failed, falling back to Gemini: {str(e)[:200]}", flush=True)
    return gemini_call()


def generate_json(prompt, instruction, schema):
    from google.genai import types

    def gemini_call():
        res = generate(types.GenerateContentConfig(
            system_instruction=instruction, temperature=0,
            response_mime_type="application/json"), prompt)
        return json.loads(res.text)

    return with_claude_first(lambda: json.loads(claude_generate(prompt, instruction, schema)), gemini_call)


def generate_text(prompt):
    from google.genai import types
    return with_claude_first(
        lambda: claude_generate(prompt),
        lambda: generate(types.GenerateContentConfig(temperature=0), prompt).text.strip())

# ---------------------------------------------------------------- load the library

CHUNKS = json.load(open(DATA_DIR / "chunks.json", encoding="utf-8"))
VECTORS = np.load(DATA_DIR / "vectors.npy").astype(np.float32)
VECTORS = VECTORS / np.linalg.norm(VECTORS, axis=1, keepdims=True)
assert len(CHUNKS) == len(VECTORS), "chunks.json and vectors.npy do not match - rebuild the index"

DOC_DEFAULTS = {"number": "", "date": "", "department": "", "type": "",
                "library": "common", "status": "in_force", "replaced_by": None}


def load_documents():
    meta = {}
    path = DATA_DIR / "documents.json"
    if path.exists():
        for d in json.load(open(path, encoding="utf-8")):
            meta[d["file"]] = d
    for name in sorted({c["document"] for c in CHUNKS}):
        meta.setdefault(name, {"file": name,
                               "title": Path(name).stem.replace("_", " ")})
    for name, d in meta.items():
        for k, v in DOC_DEFAULTS.items():
            d.setdefault(k, v)
        d.setdefault("title", Path(name).stem.replace("_", " "))
        pages = sorted({c["page"] for c in CHUNKS if c["document"] == name})
        d["pages_indexed"] = len(pages)
        d["has_file"] = (DOCS_DIR / name).exists()
    # who replaces whom (both directions)
    for d in meta.values():
        d["replaces"] = [o["file"] for o in meta.values() if o.get("replaced_by") == d["file"]]
    return meta


DOCUMENTS = load_documents()

# ---------------------------------------------------------------- helpers

ASSAMESE = re.compile(r"[ঀ-৿]")


def norm(s):
    s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    return re.sub(r"\s+", " ", s).strip().lower()


def quote_found(quote, text):
    q = norm(quote).strip('"\'. ')
    return len(q) >= 8 and q[:40] in norm(text)


def allowed(chunk, libraries, include_superseded):
    d = DOCUMENTS.get(chunk["document"], DOC_DEFAULTS)
    if libraries and d["library"] not in libraries:
        return False
    if not include_superseded and d["status"] == "superseded":
        return False
    return True


def search(question, libraries=None, include_superseded=False, k=TOP_K):
    q = embed([question], "RETRIEVAL_QUERY")[0]
    scores = VECTORS @ q
    mask = np.array([allowed(c, libraries, include_superseded) for c in CHUNKS])
    scores = np.where(mask, scores, -np.inf)
    best = [i for i in np.argsort(scores)[::-1][:k] if np.isfinite(scores[i])]
    return [(CHUNKS[i], float(scores[i])) for i in best]


def libraries_for(department):
    return {"common", department.lower()} if department else None


def doc_info(name):
    d = DOCUMENTS.get(name, {})
    return {"document": name, "title": d.get("title", name), "number": d.get("number", ""),
            "date": d.get("date", ""), "status": d.get("status", "in_force")}


def numbered_sources(results):
    out = []
    for i, (c, _) in enumerate(results, start=1):
        d = DOCUMENTS.get(c["document"], DOC_DEFAULTS)
        label = f"{d.get('title', c['document'])}, page {c['page']}"
        if d.get("date"):
            label += f", dated {d['date']}"
        if d["status"] == "superseded":
            label += ", SUPERSEDED"
        out.append(f"[{i}] ({label})\n{c['text']}")
    return "\n\n".join(out)


def check_citations(citations, results):
    """Every citation must point at a source we sent and quote it exactly."""
    checked = []
    for cit in citations or []:
        n = cit.get("n")
        if not isinstance(n, int) or not (1 <= n <= len(results)):
            return None
        chunk = results[n - 1][0]
        if not quote_found(cit.get("quote", ""), chunk["text"]):
            return None
        checked.append({"n": n, "page": chunk["page"], "quote": cit["quote"], **doc_info(chunk["document"])})
    return checked

# ---------------------------------------------------------------- logs (demo: memory + file)

LOG_FILE = DATA_DIR / "logs.jsonl"
LOGS, FEEDBACK = [], []
_lock = threading.Lock()


def log_event(entry):
    entry = {"id": uuid.uuid4().hex[:10], "time": datetime.now(timezone.utc).isoformat(), **entry}
    with _lock:
        LOGS.append(entry)
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError:
            pass
    return entry["id"]

# ---------------------------------------------------------------- prompts

ASK_INSTRUCTION = """You are Niyam Sahayak, an assistant for Government of Assam officers.
Answer ONLY using the numbered sources provided. Never use outside knowledge. Never guess.
After each sentence, cite the source number(s) like [1] or [2].
If the sources do not contain the answer, set "found" to false and set "answer" to exactly:
"Not found in approved documents."
If sources disagree, prefer the most recent document and say so. If a source is marked SUPERSEDED, say it has been replaced.
Keep the answer short (2-4 sentences) and plain.
Write the answer in {language}.
For each citation, copy a short EXACT quote (8-25 words) from that source, in the source's own language and wording.
Reply in JSON only:
{{"found": true, "answer": "...", "citations": [{{"n": 1, "quote": "..."}}]}}"""

DRAFT_INSTRUCTION = """You help Government of Assam officers draft official orders.
Using ONLY the numbered sources, identify the rule that governs the request.
Reply in JSON only:
{"found": true, "rule_reference": "short reference, e.g. Rule 4 of the Assam Services (Leave) Rules, 1934",
 "conditions": "one sentence on conditions from the rule, or empty",
 "citations": [{"n": 1, "quote": "short exact quote, 8-25 words"}]}
If no source covers it, reply {"found": false, "rule_reference": "", "conditions": "", "citations": []}.
Never use outside knowledge."""

SUMMARY_INSTRUCTION = """Summarise the government document below for a busy officer, using ONLY its text.
Reply in JSON only:
{"summary": "5-8 short sentences",
 "key_details": [{"label": "e.g. Effective date", "value": "...", "page": 3}]}
Include 4-10 key details: dates, amounts, rates, deadlines, eligibility, responsible office.
Every value must appear in the text on the page you give. Never invent anything."""

# JSON shapes the model must return (enforced by Claude's structured outputs).
CITATIONS_SCHEMA = {"type": "array", "items": {
    "type": "object", "additionalProperties": False, "required": ["n", "quote"],
    "properties": {"n": {"type": "integer"}, "quote": {"type": "string"}}}}
ASK_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["found", "answer", "citations"],
              "properties": {"found": {"type": "boolean"}, "answer": {"type": "string"},
                             "citations": CITATIONS_SCHEMA}}
DRAFT_SCHEMA = {"type": "object", "additionalProperties": False,
                "required": ["found", "rule_reference", "conditions", "citations"],
                "properties": {"found": {"type": "boolean"}, "rule_reference": {"type": "string"},
                               "conditions": {"type": "string"}, "citations": CITATIONS_SCHEMA}}
SUMMARY_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["summary", "key_details"],
                  "properties": {"summary": {"type": "string"}, "key_details": {"type": "array", "items": {
                      "type": "object", "additionalProperties": False, "required": ["label", "value", "page"],
                      "properties": {"label": {"type": "string"}, "value": {"type": "string"},
                                     "page": {"type": "integer"}}}}}}

# ---------------------------------------------------------------- templates

TEMPLATES = {
    "leave_sanction_order": {
        "name": "Leave sanction order",
        "fields": ["name", "designation", "office", "leave_type", "from_date", "to_date", "days"],
        "search": "rules for sanction of {leave_type}, eligibility and conditions",
        "text": (
            "GOVERNMENT OF ASSAM\n"
            "OFFICE OF THE {office}\n\n"
            "ORDER\n\n"
            "No. __________                                   Dated: __________\n\n"
            "In terms of {rule_reference}, {leave_type} for {days} day(s) with effect from "
            "{from_date} to {to_date} is hereby sanctioned to {name}, {designation}, {office}.\n\n"
            "{conditions}\n\n"
            "                                                  Sd/-\n"
            "                                                  (Sanctioning Authority)\n\n"
            "Memo No. __________                              Dated: __________\n"
            "Copy to:\n"
            "1. The officer concerned.\n"
            "2. The Accountant General (A&E), Assam.\n"
            "3. Office file."
        ),
    },
}

# ---------------------------------------------------------------- API

app = FastAPI(title="Niyam Sahayak API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(ModelBusy)
def model_busy(_request, _exc):
    return JSONResponse(status_code=503, content={
        "detail": "The AI service is very busy right now. Please try again in a minute."})


class AskIn(BaseModel):
    question: str
    department: Optional[str] = None          # e.g. "assac" -> searches common + assac
    include_superseded: bool = False
    role: Optional[str] = "officer"


class DraftIn(BaseModel):
    template: str = "leave_sanction_order"
    fields: dict
    department: Optional[str] = None


class SummariseIn(BaseModel):
    document: str


class FeedbackIn(BaseModel):
    log_id: str
    rating: str                               # "up" | "down" | "report"
    note: Optional[str] = ""


@app.get("/health")
def health():
    return {"status": "ok", "documents": len(DOCUMENTS), "pieces": len(CHUNKS),
            "model": CLAUDE_MODEL if USE_CLAUDE else GEN_MODEL,
            "fallback_models": GEN_MODELS if USE_CLAUDE else GEN_FALLBACK_MODELS}


@app.get("/documents")
def list_documents(department: Optional[str] = None):
    libs = libraries_for(department)
    docs = [d for d in DOCUMENTS.values() if not libs or d["library"] in libs]
    docs = sorted(docs, key=lambda d: d.get("date") or "", reverse=True)        # newest first
    return sorted(docs, key=lambda d: d["status"] != "in_force")                 # in-force before superseded


@app.get("/documents/{file}/file")
def document_file(file: str):
    if file not in DOCUMENTS or "/" in file or ".." in file:
        raise HTTPException(404, "Unknown document")
    path = DOCS_DIR / file
    if not path.exists():
        raise HTTPException(404, "PDF not uploaded to the server")
    return FileResponse(path, media_type="application/pdf")


@app.post("/ask")
def ask(body: AskIn):
    started = time.time()
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Question is empty")

    language = "Assamese" if ASSAMESE.search(question) else "English"
    search_q = question
    if language == "Assamese":
        search_q = generate_text(f"Translate this question into English. Reply with the translation only.\n\n{question}")

    results = search(search_q, libraries_for(body.department), body.include_superseded)
    response = {"question": question, "language": language, "found": False,
                "answer": NOT_FOUND, "citations": [], "replaces": []}

    if results:
        out = generate_json(f"SOURCES:\n{numbered_sources(results)}\n\nQUESTION: {question}",
                            ASK_INSTRUCTION.format(language=language), ASK_SCHEMA)
        citations = check_citations(out.get("citations"), results)
        if out.get("found") and citations:
            response.update(found=True, answer=out.get("answer", ""), citations=citations)
            cited = {c["document"] for c in citations}
            response["replaces"] = [doc_info(o) for d in cited for o in DOCUMENTS.get(d, {}).get("replaces", [])]
        elif out.get("found") and citations is None:
            response["source_check_failed"] = True

    response["latency_ms"] = int((time.time() - started) * 1000)
    response["log_id"] = log_event({"type": "ask", "role": body.role, "department": body.department,
                                    "question": question, "found": response["found"],
                                    "answer": response["answer"],
                                    "sources": [f"{c['document']} p{c['page']}" for c in response["citations"]]})
    return response


@app.get("/templates")
def templates():
    return [{"id": k, "name": t["name"], "fields": t["fields"]} for k, t in TEMPLATES.items()]


@app.post("/draft")
def draft(body: DraftIn):
    t = TEMPLATES.get(body.template)
    if not t:
        raise HTTPException(404, "Unknown template")
    missing = [f for f in t["fields"] if not str(body.fields.get(f, "")).strip()]
    if missing:
        raise HTTPException(400, f"Missing fields: {', '.join(missing)}")

    results = search(t["search"].format(**body.fields), libraries_for(body.department))
    out = generate_json(f"SOURCES:\n{numbered_sources(results)}\n\nREQUEST: {t['name']} for {body.fields['leave_type']}",
                        DRAFT_INSTRUCTION, DRAFT_SCHEMA) if results else {"found": False}
    citations = check_citations(out.get("citations"), results) if out.get("found") else None
    found = bool(citations)

    text = t["text"].format(
        **body.fields,
        rule_reference=out.get("rule_reference") if found else "[rule reference: not found in approved documents - please add]",
        conditions=out.get("conditions", "") if found else "")
    log_id = log_event({"type": "draft", "template": body.template, "found": found})
    return {"draft": text, "found": found, "citations": citations or [], "log_id": log_id,
            "note": "Draft for review only. Verify against the cited rule before signing."}


@app.post("/summarise")
def summarise(body: SummariseIn):
    if body.document not in DOCUMENTS:
        raise HTTPException(404, "Unknown document")
    pieces = sorted([c for c in CHUNKS if c["document"] == body.document], key=lambda c: (c["page"], c["id"]))[:25]
    if not pieces:
        raise HTTPException(404, "Document has no readable text")
    text = "\n\n".join(f"[page {c['page']}]\n{c['text']}" for c in pieces)
    out = generate_json(text, SUMMARY_INSTRUCTION, SUMMARY_SCHEMA)

    page_text = {}
    for c in pieces:
        page_text[c["page"]] = page_text.get(c["page"], "") + " " + c["text"]
    details = []
    for d in out.get("key_details", []):
        p = d.get("page")
        value = str(d.get("value", ""))
        verified = p in page_text and norm(value)[:30] in norm(page_text[p])
        details.append({"label": d.get("label", ""), "value": value, "page": p, "verified": verified})

    log_id = log_event({"type": "summarise", "document": body.document})
    return {**doc_info(body.document), "summary": out.get("summary", ""),
            "key_details": details, "pages_used": sorted(page_text), "log_id": log_id}


@app.post("/feedback")
def feedback(body: FeedbackIn):
    if body.rating not in {"up", "down", "report"}:
        raise HTTPException(400, "rating must be up, down or report")
    entry = {"log_id": body.log_id, "rating": body.rating, "note": body.note,
             "time": datetime.now(timezone.utc).isoformat()}
    with _lock:
        FEEDBACK.append(entry)
    log_event({"type": "feedback", **entry})
    return {"ok": True}


@app.get("/logs")
def logs(limit: int = Query(50, le=500)):
    with _lock:
        recent = list(reversed(LOGS[-limit:]))
        fb = list(reversed(FEEDBACK[-limit:]))
    return {"events": recent, "feedback": fb}
