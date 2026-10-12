import os
import io
import json
import re
import time
import sqlite3
from pathlib import Path
from typing import Optional

import requests
from pypdf import PdfReader
from fastapi import (
    APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
)
from pydantic import BaseModel, Field

try:
    from backend.assessment_auth import current_user, AuthenticatedUser
except ImportError:
    from assessment_auth import current_user, AuthenticatedUser

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])

_db_env = os.getenv("DATABASE_PATH", "auth.db")
DB_PATH = Path(__file__).resolve().parent / _db_env if not os.path.isabs(_db_env) else Path(_db_env)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
DEFAULT_MODEL_NAME = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")


MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB limit
MAX_PAGES = 100
MAX_QUESTIONS = 10


# ---------- DATABASE ----------

def db():
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                user_email TEXT NOT NULL,
                pdf_name TEXT NOT NULL,
                questions_json TEXT NOT NULL,
                answers_json TEXT,
                score REAL,
                total_questions INTEGER NOT NULL,
                question_type TEXT DEFAULT 'mixed',
                difficulty TEXT DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'in_progress',
                created_at INTEGER NOT NULL,
                completed_at INTEGER
            )
        """)
        # Safe migration for existing databases
        for col_def in [
            ("question_type", "TEXT DEFAULT 'mixed'"),
            ("difficulty", "TEXT DEFAULT 'medium'"),
            ("duration_minutes", "INTEGER DEFAULT 15"),
            ("started_at", "INTEGER"),
            ("deadline", "INTEGER"),
            ("auto_submitted", "INTEGER DEFAULT 0"),
        ]:
            try:
                conn.execute(f"ALTER TABLE assessments ADD COLUMN {col_def[0]} {col_def[1]}")
            except sqlite3.OperationalError:
                pass
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_assessments_user_id
            ON assessments(user_id, created_at)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_assessments_user_email
            ON assessments(user_email, created_at)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                user_email TEXT NOT NULL,
                filename TEXT NOT NULL,
                text_content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_documents_user
            ON user_documents(user_id, created_at)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tutor_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                document_id INTEGER,
                sender TEXT NOT NULL,
                text TEXT NOT NULL,
                source_file TEXT,
                source_excerpt TEXT,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tutor_messages_user
            ON tutor_messages(user_id, created_at)
        """)



# ---------- CLOUD GROQ & LLM MODEL RESOLUTION & INFERENCE ----------

_GROQ_MODELS_CACHE = {"timestamp": 0, "models": []}


def get_groq_models(api_key: str) -> list[str]:
    """
    Discovers available models on the Groq account dynamically.
    Caches results for 5 minutes.
    Prioritizes ultra-fast high-parameter models: gpt-oss-120b, qwen3.8-27b, gpt-oss-20b.
    """
    now = time.time()
    if _GROQ_MODELS_CACHE["models"] and (now - _GROQ_MODELS_CACHE["timestamp"] < 300):
        return _GROQ_MODELS_CACHE["models"]

    preferred_priority = [
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768"
    ]

    try:
        resp = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=5
        )
        if resp.status_code == 200:
            available_ids = {m.get("id") for m in resp.json().get("data", []) if m.get("id")}
            # Match in preferred order
            selected = [m for m in preferred_priority if m in available_ids]
            # Add any remaining chat-capable models
            for mid in available_ids:
                if mid not in selected and not any(skip in mid for skip in ["whisper", "guard", "safeguard", "orpheus"]):
                    selected.append(mid)

            if selected:
                _GROQ_MODELS_CACHE["models"] = selected
                _GROQ_MODELS_CACHE["timestamp"] = now
                print(f"[GROQ AI] Active available models: {selected}", flush=True)
                return selected
    except Exception as ex:
        print(f"[GROQ AI] Warning: Could not fetch models list: {ex}", flush=True)

    return preferred_priority


def ask_qwen(prompt: str, as_json: bool = True) -> str:
    """
    Executes fast cloud inference via Groq API.
    Falls back gracefully across discovered models and Gemini if available.
    """
    # 1. Cloud Groq AI (Superfast: ~0.8s - 1.3s inference)
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_api_key:
        active_models = get_groq_models(groq_api_key)
        headers = {
            "Authorization": f"Bearer {groq_api_key}",
            "Content-Type": "application/json"
        }

        for groq_model in active_models:
            attempts = [True, False] if as_json else [False]
            for try_json_format in attempts:
                try:
                    t0 = time.time()
                    body = {
                        "model": groq_model,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are an expert educational assessment generator. "
                                    "Return only valid, well-formed JSON matching the requested structure."
                                    if as_json else
                                    "You are a helpful, knowledgeable academic tutor."
                                )
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.2
                    }
                    if try_json_format:
                        body["response_format"] = {"type": "json_object"}

                    resp = requests.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers=headers,
                        json=body,
                        timeout=35
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"].strip()
                        elapsed = time.time() - t0
                        print(f"[GROQ AI] Success with {groq_model} in {elapsed:.2f}s!", flush=True)
                        return content
                    elif resp.status_code == 400 and try_json_format:
                        # Retry model without response_format constraint
                        continue
                    else:
                        print(f"[GROQ AI] Model {groq_model} returned {resp.status_code}: {resp.text[:120]}, trying next...", flush=True)
                        break
                except Exception as ex:
                    print(f"[GROQ AI] Model {groq_model} exception: {ex}", flush=True)
                    break

    # 2. Cloud Google Gemini API (Fallback)
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key:
        try:
            t0 = time.time()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2}
            }
            if as_json:
                payload["generationConfig"]["responseMimeType"] = "application/json"
            resp = requests.post(url, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                elapsed = time.time() - t0
                print(f"[GEMINI AI] Response received in {elapsed:.2f}s", flush=True)
                return content
        except Exception as e:
            print(f"[GEMINI AI ERROR] Failed: {e}", flush=True)

    raise RuntimeError("Cloud AI services unavailable or model error.")



def generate_fallback_questions(
    text: str,
    count: int = 5,
    question_type: str = "mcq",
    difficulty: str = "medium"
) -> list[dict]:
    # Clean text and filter out presentation headers and course metadata
    cleaned = re.sub(r'\s+', ' ', text).strip()
    raw_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', cleaned) if len(s.strip()) >= 30]

    filtered_sentences = []
    for s in raw_sentences:
        s_clean = re.sub(r'^(?:Lecture Material|UNIT\s+[IVX0-9]+|Slide\s+\d+|[0-9]+\.\s+)+', '', s, flags=re.IGNORECASE).strip()
        s_lower = s_clean.lower()
        if any(ign in s_lower for ign in ["lecture material", "course code", "syllabus", "prepared by", "department of", "page "]):
            continue
        if len(s_clean.split()) >= 5 and len(s_clean) >= 35:
            filtered_sentences.append(s_clean)

    if len(filtered_sentences) < count:
        filtered_sentences = raw_sentences if raw_sentences else ["The provided document contains key foundational concepts."]

    questions = []
    q_type = (question_type or "mcq").strip().lower()
    if q_type not in ("mcq", "question_answer", "mixed"):
        q_type = "mcq"

    mcq_count = count if q_type == "mcq" else (0 if q_type == "question_answer" else max(1, count // 2 + 1))
    qa_count = count - mcq_count if q_type == "mixed" else (count if q_type == "question_answer" else 0)

    # Question stem templates to avoid repetitive phrasing
    stems = [
        "According to the document, what is the primary function or definition of the concept discussed?",
        "Based on the provided text, which of the following is identified as a fundamental characteristic or principle?",
        "In the context of the study material, what is stated regarding the transmission and delivery requirements?",
        "Which of the following statements accurately reflects the core explanation given in the material?",
        "What key condition or rule is emphasized in the uploaded document?"
    ]

    # 1. Generate Multiple Choice Questions from informative sentences
    for i in range(mcq_count):
        idx = (i * 2) % len(filtered_sentences)
        target = filtered_sentences[idx]

        # Extract subject / predicate for natural phrasing
        m_def = re.match(r'^([A-Za-z\s]{3,35})\s+(?:are|is|refers to|is defined as|means)\s+(.+)', target, re.IGNORECASE)
        m_dep = re.search(r'([A-Za-z\s]{4,40})\s+(?:depends on|consists of|requires)\s+(.+)', target, re.IGNORECASE)

        if m_def:
            term = m_def.group(1).strip()
            def_text = m_def.group(2).strip().rstrip('.')
            q_stem = f"According to the material, what is the definition or role of '{term}'?"
            correct_val = def_text[:90] + ("..." if len(def_text) > 90 else "")
        elif m_dep:
            subj = m_dep.group(1).strip()
            pred = m_dep.group(2).strip().rstrip('.')
            q_stem = f"Based on the text, what does {subj.lower()} primarily depend on or involve?"
            correct_val = pred[:90] + ("..." if len(pred) > 90 else "")
        else:
            q_stem = stems[i % len(stems)]
            correct_val = target[:90] + ("..." if len(target) > 90 else "")

        # Pick 3 plausible distractors from other sentences in the same document
        distractors = []
        for offset in [1, 2, 3]:
            d_idx = (idx + offset) % len(filtered_sentences)
            if d_idx != idx:
                d_text = filtered_sentences[d_idx]
                distractors.append(d_text[:85] + ("..." if len(d_text) > 85 else ""))
        while len(distractors) < 3:
            distractors.append("Unrelated or contrary to the principles described in the document.")

        all_options = [correct_val] + distractors[:3]
        correct_letter = ["A", "B", "C", "D"][i % 4]
        c_idx = ord(correct_letter) - ord("A")
        all_options[0], all_options[c_idx] = all_options[c_idx], all_options[0]

        formatted_options = [
            f"A) {all_options[0]}",
            f"B) {all_options[1]}",
            f"C) {all_options[2]}",
            f"D) {all_options[3]}"
        ]

        questions.append({
            "type": "mcq",
            "question": q_stem,
            "options": formatted_options,
            "correct_answer": correct_letter,
            "explanation": f"Referenced directly from the source material: \"{target}\""
        })

    # 2. Generate Descriptive Q&A Questions from informative sentences
    for j in range(qa_count):
        idx = (j * 2 + 1) % len(filtered_sentences)
        target = filtered_sentences[idx]

        words = [w for w in re.findall(r'\b[A-Za-z]{4,}\b', target) if w.lower() not in ('this', 'that', 'with', 'from', 'have', 'were', 'they', 'which', 'about', 'their')]
        rubric_items = words[:3] if len(words) >= 3 else ["Core concept accuracy", "Clarity of explanation", "Reference to document"]

        questions.append({
            "type": "question_answer",
            "question": f"Explain the key concept and operational requirements discussed in this excerpt: \"{target[:95]}...\"",
            "reference_answer": target,
            "rubric": rubric_items
        })

    print(f"[ASSESSMENT GEN] Document intelligence engine generated {len(questions)} natural questions directly from PDF!", flush=True)
    return questions[:count]




def parse_model_json(text: str):
    text = text.strip()
    # Normalize fancy unicode quotes and dashes
    text = text.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-').replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
    # Strip any <think> ... </think> tags
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Extract outer object { ... }
    start_obj = text.find("{")
    end_obj = text.rfind("}")
    if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
        try:
            return json.loads(text[start_obj : end_obj + 1])
        except json.JSONDecodeError:
            pass

    # Extract outer array [ ... ]
    start_arr = text.find("[")
    end_arr = text.rfind("]")
    if start_arr != -1 and end_arr != -1 and end_arr > start_arr:
        try:
            parsed_arr = json.loads(text[start_arr : end_arr + 1])
            return {"questions": parsed_arr}
        except json.JSONDecodeError:
            pass

    # If JSON was cut off mid-stream, repair by finding last complete item and closing brackets
    if start_obj != -1 and '"questions"' in text:
        last_item_end = text.rfind("}")
        if last_item_end > start_obj:
            for suffix in ["]}", "}]}", "\"}]}", "]}"]:
                try:
                    return json.loads(text[start_obj : last_item_end + 1] + suffix)
                except json.JSONDecodeError:
                    continue

    # Regex extraction of individual valid question objects {...}
    extracted_items = []
    matches = re.finditer(r"\{[^{}]*\"question\"[^{}]*\}", text, flags=re.DOTALL)
    for m in matches:
        try:
            item = json.loads(m.group(0))
            if "question" in item:
                extracted_items.append(item)
        except json.JSONDecodeError:
            continue

    if extracted_items:
        return {"questions": extracted_items}

    raise HTTPException(502, "Could not parse the AI model response as valid JSON.")


# ---------- PDF EXTRACTION ----------

async def read_pdf(file: UploadFile) -> str:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a valid PDF file.")

    data = await file.read(MAX_PDF_SIZE + 1)

    if len(data) > MAX_PDF_SIZE:
        raise HTTPException(413, "PDF must be 10 MB or smaller.")

    try:
        reader = PdfReader(io.BytesIO(data), strict=True)

        if reader.is_encrypted:
            raise HTTPException(
                400, "Password-protected PDFs are not supported. Please remove the password and try again."
            )

        if len(reader.pages) > MAX_PAGES:
            raise HTTPException(
                400, f"PDF exceeds the maximum limit of {MAX_PAGES} pages."
            )

        pages_text = []
        for page in reader.pages:
            t = (page.extract_text() or "").strip()
            if t:
                pages_text.append(t)
        raw_text = "\n\n".join(pages_text)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Unable to read this PDF file. The file may be corrupted.")

    # Clean whitespace while preserving line structure
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if len(text) < 200:
        raise HTTPException(
            400,
            "Not enough readable text found in PDF (minimum 200 characters required). Scanned image PDFs require OCR preprocessing before upload."
        )

    return text


# ---------- QUESTION GENERATION ----------

def generate_questions(
    text: str,
    count: int = 5,
    question_type: str = "mcq",
    difficulty: str = "medium"
):
    count = max(1, min(MAX_QUESTIONS, count))
    q_type = (question_type or "mcq").strip().lower()
    if q_type not in ("mcq", "question_answer", "mixed"):
        q_type = "mcq"

    diff = (difficulty or "medium").strip().lower()
    if diff not in ("easy", "medium", "hard"):
        diff = "medium"

    # Clean text to remove presentation headers, course codes, and slide metadata
    clean_lines = []
    for line in text.split("\n"):
        line_clean = line.strip()
        if not line_clean:
            continue
        line_lower = line_clean.lower()
        if any(ign in line_lower for ign in [
            "lecture material", "course code", "syllabus", "prepared by",
            "department of", "page ", "approved by", "academic year"
        ]):
            continue
        if re.match(r"^(?:unit\s+[ivx0-9]+|slide\s+\d+|[0-9]+\s*$)", line_lower):
            continue
        clean_lines.append(line_clean)

    filtered_text = "\n".join(clean_lines) if clean_lines else text
    source = filtered_text[:6000] if len(filtered_text) > 6000 else filtered_text

    diff_guidelines = {
        "easy": "DIFFICULTY LEVEL: EASY. Test foundational definitions, explicit facts, direct recall, and straightforward concepts explicitly stated in the source text.",
        "medium": "DIFFICULTY LEVEL: MEDIUM. Test conceptual understanding, comparisons, practical applications, cause-and-effect relationships, and key concepts.",
        "hard": "DIFFICULTY LEVEL: HARD. Test deep analytical reasoning, edge cases, trade-offs, critical evaluation, and multi-concept synthesis from the source text."
    }
    diff_instruction = diff_guidelines.get(diff, diff_guidelines["medium"])

    if q_type == "mcq":
        prompt = f"""You are an educational assessment generator.

Create exactly {count} multiple-choice questions (MCQs) based ONLY on the conceptual content in the source text below.
{diff_instruction}

STRICT REQUIREMENTS FOR EACH MCQ:
- Focus on key concepts, mechanisms, definitions, and functions explained in the material.
- NEVER create questions about slide numbers, course codes, lecture metadata, or document headings.
- Provide 4 distinct, plausible options formatted as ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"].
- Exactly ONE option must be correct. The other three options must be realistic, plausible distractors from the same subject domain.
- "correct_answer" MUST be the single uppercase letter: "A", "B", "C", or "D".
- "explanation" must clearly explain why the correct option is right based on the material (1-2 sentences).

Return valid JSON in this exact structure:
{{
  "questions": [
    {{
      "question": "Clear, specific question about a concept from the text?",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "Why this option is correct based on the text."
    }}
  ]
}}

SOURCE TEXT:
{source}
"""
    elif q_type == "question_answer":
        prompt = f"""You are an educational assessment generator.

Create exactly {count} descriptive assessment questions based ONLY on the source text below.
{diff_instruction}

STRICT REQUIREMENTS:
- Focus on key concepts, mechanisms, definitions, and functions explained in the material.
- NEVER ask about slide numbers, course codes, or lecture metadata.
- Clear descriptive question requiring a thoughtful typed response.
- "reference_answer": Concise expected answer supported by the source text (1-2 sentences).
- "rubric": 2 to 4 key grading points/criteria (3-8 words each).

Return valid JSON in this exact structure:
{{
  "questions": [
    {{
      "question": "Clear descriptive question directly answerable from the source?",
      "reference_answer": "Concise expected answer.",
      "rubric": ["Key point 1", "Key point 2"]
    }}
  ]
}}

SOURCE TEXT:
{source}
"""
    else:  # mixed
        if count == 3:
            mcq_count = 2
            qa_count = 1
        elif count == 5:
            mcq_count = 3
            qa_count = 2
        elif count == 10:
            mcq_count = 6
            qa_count = 4
        else:
            mcq_count = max(1, count // 2 + 1)
            qa_count = max(1, count - mcq_count)

        prompt = f"""You are an educational assessment generator.

Create a balanced MIXED assessment with exactly {count} total questions: {mcq_count} Multiple Choice Questions (MCQ) followed by {qa_count} Descriptive Questions based ONLY on the source text below.
{diff_instruction}

STRICT REQUIREMENTS:
- Focus on key concepts, mechanisms, definitions, and functions explained in the material.
- NEVER ask about slide numbers, course codes, or lecture metadata.
- The first {mcq_count} questions must be "type": "mcq" with 4 options ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_answer" ("A", "B", "C", or "D"), and "explanation".
- The remaining {qa_count} questions must be "type": "question_answer" with a "reference_answer" and a "rubric".

Return valid JSON in this exact structure:
{{
  "questions": [
    {{
      "type": "mcq",
      "question": "Multiple choice question?",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "Why A is correct."
    }},
    {{
      "type": "question_answer",
      "question": "Descriptive question?",
      "reference_answer": "Expected answer.",
      "rubric": ["Key point 1", "Key point 2"]
    }}
  ]
}}

SOURCE TEXT:
{source}
"""

    t0 = time.time()
    print(f"[ASSESSMENT GEN] [Stage 4/6] Generating questions (source_len={len(source)}, count={count}, type={q_type}, diff={diff})", flush=True)

    try:
        raw_response = ask_qwen(prompt, as_json=True)
        elapsed = time.time() - t0
        print(f"[ASSESSMENT GEN] [Stage 5/6] AI response received in {elapsed:.2f}s", flush=True)
        data = parse_model_json(raw_response)
        raw_questions = data.get("questions", [])
        if not isinstance(raw_questions, list) or len(raw_questions) == 0:
            raise ValueError("No questions parsed from AI model response.")
    except Exception as err:
        print(f"[ASSESSMENT GEN] Cloud AI exception ({err}). Using Document Intelligence engine to generate questions directly...", flush=True)
        return generate_fallback_questions(text, count, q_type, diff)

    questions = []
    seen = set()

    for item in raw_questions:
        if len(questions) >= count or not isinstance(item, dict):
            continue

        q_text = str(item.get("question", "")).strip()
        if len(q_text) < 10 or q_text.lower() in seen:
            continue

        item_type = item.get("type", "").lower()
        options = item.get("options")

        # Detect item type
        is_mcq = (q_type == "mcq") or (item_type == "mcq") or (isinstance(options, list) and len(options) >= 2)

        if is_mcq:
            raw_opts = options if isinstance(options, list) else []
            if len(raw_opts) < 4:
                defaults = ["Option A", "Option B", "Option C", "Option D"]
                raw_opts = raw_opts + defaults[len(raw_opts):]

            # Format options cleanly with consistent A), B), C), D) prefixes
            clean_opts = []
            for idx_o, o in enumerate(raw_opts[:4]):
                prefix = ["A) ", "B) ", "C) ", "D) "][idx_o]
                o_str = str(o).strip()
                o_clean = re.sub(r'^(?:[A-D][\)\.]|\([A-D]\))\s*', '', o_str).strip()
                clean_opts.append(f"{prefix}{o_clean}")

            # Resolve correct answer letter
            corr_input = str(item.get("correct_answer", item.get("answer", "A"))).strip()
            corr_letter = "A"
            if corr_input and corr_input[0].upper() in ("A", "B", "C", "D") and len(corr_input) <= 3:
                corr_letter = corr_input[0].upper()
            else:
                for idx_o, o in enumerate(raw_opts[:4]):
                    o_clean = re.sub(r'^(?:[A-D][\)\.]|\([A-D]\))\s*', '', str(o)).strip()
                    if corr_input.lower() == o_clean.lower():
                        corr_letter = ["A", "B", "C", "D"][idx_o]
                        break

            explanation = str(item.get("explanation", "")).strip()
            seen.add(q_text.lower())
            questions.append({
                "type": "mcq",
                "question": q_text,
                "options": clean_opts,
                "correct_answer": corr_letter,
                "explanation": explanation or "Correct answer based on the uploaded document.",
                "max_marks": 10
            })
        else:
            answer = str(item.get("reference_answer", "")).strip()
            rubric = item.get("rubric", [])
            if len(answer) < 2:
                answer = "Comprehensive answer grounded in course material."
            if not isinstance(rubric, list) or not rubric:
                rubric = ["Conceptual accuracy", "Key supporting details"]

            seen.add(q_text.lower())
            questions.append({
                "type": "question_answer",
                "question": q_text,
                "reference_answer": answer,
                "rubric": [str(point)[:300] for point in rubric[:6] if str(point).strip()],
                "max_marks": 10
            })

    if not questions:
        raise HTTPException(
            422, "The AI model could not generate valid educational questions from this PDF content."
        )

    print(f"[ASSESSMENT GEN] [Stage 6/6] Successfully parsed {len(questions)} valid questions (type={q_type})", flush=True)
    return questions


# ---------- GENERATE ASSESSMENT ENDPOINT ----------

@router.post("/generate")
async def generate_assessment(
    file: UploadFile = File(...),
    count: int = Form(5),
    question_type: str = Form("mcq"),
    difficulty: str = Form("medium"),
    duration_minutes: int = Form(15),
    q_count: Optional[int] = Query(None, alias="count"),
    q_type: Optional[str] = Query(None, alias="question_type"),
    q_diff: Optional[str] = Query(None, alias="difficulty"),
    q_duration: Optional[int] = Query(None, alias="duration_minutes"),
    user: AuthenticatedUser = Depends(current_user)
):
    # Resolve parameters from Form or Query
    effective_count = q_count if q_count is not None else count
    effective_type = (q_type or question_type or "mcq").strip().lower()
    effective_diff = (q_diff or difficulty or "medium").strip().lower()
    effective_duration = q_duration if q_duration is not None else duration_minutes

    if effective_type not in ("mcq", "question_answer", "mixed"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid question_type '{effective_type}'. Supported types: 'mcq', 'question_answer', 'mixed'."
        )

    if effective_diff not in ("easy", "medium", "hard"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid difficulty '{effective_diff}'. Supported levels: 'easy', 'medium', 'hard'."
        )

    # Validate question count (support 3, 5, 10 or custom safe count 1 to 15)
    if not (1 <= effective_count <= 15):
        raise HTTPException(
            status_code=422,
            detail="Invalid question count. Please choose between 1 and 15 questions."
        )

    # Validate test duration (1 to 180 minutes)
    if not (1 <= effective_duration <= 180):
        raise HTTPException(
            status_code=422,
            detail="Invalid test duration. Please choose between 1 and 180 minutes."
        )

    filename = Path(file.filename or "upload.pdf").name
    print(f"[ASSESSMENT GEN] [Stage 1/6] Request received for filename='{filename}', count={effective_count}, type={effective_type}, diff={effective_diff}, duration={effective_duration}m", flush=True)
    print(f"[ASSESSMENT GEN] [Stage 2/6] Authentication verified for user_id='{user.id}'", flush=True)

    text = await read_pdf(file)
    print(f"[ASSESSMENT GEN] [Stage 3/6] PDF extracted successfully: {len(text)} characters", flush=True)

    questions = generate_questions(text, effective_count, effective_type, effective_diff)

    with db() as conn:
        conn.execute("""
            INSERT INTO user_documents (user_id, user_email, filename, text_content, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (user.id, user.email, filename, text, int(time.time())))

        cursor = conn.execute("""
            INSERT INTO assessments (
                user_id, user_email, pdf_name, questions_json,
                total_questions, question_type, difficulty, duration_minutes,
                created_at, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress')
        """, (
            user.id,
            user.email,
            filename,
            json.dumps(questions),
            len(questions),
            effective_type,
            effective_diff,
            effective_duration,
            int(time.time())
        ))
        assessment_id = cursor.lastrowid

    print(f"[ASSESSMENT GEN] Response ready: assessment_id={assessment_id}, returning {len(questions)} questions, duration={effective_duration}m", flush=True)

    # Return questions to student WITHOUT exposing reference_answer or correct_answer or rubric!
    return {
        "assessment_id": assessment_id,
        "filename": filename,
        "total_questions": len(questions),
        "question_type": effective_type,
        "difficulty": effective_diff,
        "duration_minutes": effective_duration,
        "questions": [
            {
                "id": i + 1,
                "type": q.get("type", "question_answer"),
                "question": q["question"],
                "options": q.get("options") if q.get("type") == "mcq" else None,
                "max_marks": q.get("max_marks", 10)
            }
            for i, q in enumerate(questions)
        ]
    }



@router.post("/{assessment_id}/start")
def start_assessment(
    assessment_id: int,
    user: AuthenticatedUser = Depends(current_user)
):
    with db() as conn:
        row = conn.execute("""
            SELECT * FROM assessments
            WHERE id = ? AND (user_id = ? OR user_email = ?)
        """, (assessment_id, user.id, user.email)).fetchone()

        if not row:
            raise HTTPException(404, "Assessment not found.")

        duration = row["duration_minutes"] if ("duration_minutes" in row.keys() and row["duration_minutes"]) else 15
        now = int(time.time())

        # If already started, retain original start time and deadline
        if "started_at" in row.keys() and row["started_at"] and "deadline" in row.keys() and row["deadline"]:
            started_at = row["started_at"]
            deadline = row["deadline"]
        else:
            started_at = now
            deadline = now + int(duration * 60)
            conn.execute("""
                UPDATE assessments
                SET started_at = ?, deadline = ?
                WHERE id = ?
            """, (started_at, deadline, assessment_id))

    remaining = max(0, deadline - int(time.time()))
    return {
        "assessment_id": assessment_id,
        "started_at": started_at,
        "deadline": deadline,
        "duration_minutes": duration,
        "remaining_seconds": remaining,
        "server_time": int(time.time())
    }



# ---------- EVALUATION ----------

class AnswerSubmission(BaseModel):
    assessment_id: int
    answers: dict[str, str] = Field(..., description="Mapping of question index ('1', '2', ...) to student answer text")
    is_auto_submit: bool = False


def evaluate_answer(question: str, reference: str, rubric: list, answer: str):
    answer_clean = answer.strip()
    if not answer_clean:
        return {
            "score": 0.0,
            "feedback": "No answer was provided for this question.",
            "correct_points": [],
            "missing_points": [str(p) for p in rubric[:4]] if rubric else ["No response provided"]
        }

    prompt = f"""
You are a careful educational evaluator.

Evaluate the student's answer ONLY against the question, reference answer, and rubric below.
Do not reward unrelated content. Accept reasonable alternative wording when the meaning is correct.

Return only valid JSON:
{{
  "score": 0,
  "feedback": "Short specific feedback explaining the assessment",
  "correct_points": ["Point correctly covered"],
  "missing_points": ["Important missing point"]
}}

Score must be a number from 0 to 100.
Be fair. An empty or completely irrelevant answer receives 0.
Do not assume that the reference answer is the only valid wording.

QUESTION:
{question}

REFERENCE ANSWER:
{reference}

RUBRIC:
{json.dumps(rubric)}

STUDENT ANSWER:
{answer_clean[:5000]}
"""

    try:
        raw_output = ask_qwen(prompt, as_json=True)
        result = parse_model_json(raw_output)
        score = float(result.get("score", 0))
        score = max(0.0, min(100.0, score))
        feedback = str(result.get("feedback", "Answer evaluated."))[:1000]
        correct_points = result.get("correct_points", [])[:8]
        missing_points = result.get("missing_points", [])[:8]
    except Exception:
        # Fallback evaluation based on rubric keyword grounding if model returns malformed JSON
        ref_words = set(re.findall(r"\w{3,}", reference.lower()))
        ans_words = set(re.findall(r"\w{3,}", answer_clean.lower()))
        overlap = len(ref_words & ans_words) / max(1, len(ref_words))
        score = round(min(100.0, max(15.0, overlap * 100)), 2)
        feedback = "Answer evaluated based on key conceptual overlap with course material."
        correct_points = ["Relevant conceptual terms identified in submission."]
        missing_points = [str(p) for p in rubric[:2]]

    return {
        "score": round(score, 2),
        "feedback": feedback,
        "correct_points": correct_points,
        "missing_points": missing_points
    }



# ---------- SUBMIT ASSESSMENT ENDPOINT ----------

@router.post("/submit")
def submit_assessment(
    payload: AnswerSubmission,
    user: AuthenticatedUser = Depends(current_user)
):
    with db() as conn:
        assessment = conn.execute("""
            SELECT * FROM assessments
            WHERE id = ? AND (user_id = ? OR user_email = ?)
        """, (payload.assessment_id, user.id, user.email)).fetchone()

        if not assessment:
            raise HTTPException(404, "Assessment not found.")

        # If already submitted, return the completed result idempotently to prevent race condition crashes
        if assessment["status"] == "completed":
            saved_results = json.loads(assessment["answers_json"]) if assessment["answers_json"] else []
            return {
                "assessment_id": payload.assessment_id,
                "score": assessment["score"] or 0,
                "total_questions": assessment["total_questions"],
                "question_type": assessment["question_type"] if "question_type" in assessment.keys() else "mixed",
                "difficulty": assessment["difficulty"] if "difficulty" in assessment.keys() else "medium",
                "auto_submitted": bool(assessment["auto_submitted"]) if "auto_submitted" in assessment.keys() else False,
                "results": saved_results
            }

        # Check deadline and auto-submit flag
        now = int(time.time())
        is_auto = bool(payload.is_auto_submit)
        if "deadline" in assessment.keys() and assessment["deadline"]:
            if now >= assessment["deadline"]:
                is_auto = True

        questions = json.loads(assessment["questions_json"])

        expected_keys = {str(i + 1) for i in range(len(questions))}
        # Allow missing keys in auto-submit by populating empty answers
        if is_auto:
            for k in expected_keys:
                if k not in payload.answers:
                    payload.answers[k] = ""
        elif set(payload.answers.keys()) != expected_keys:
            raise HTTPException(
                400, f"Submit exactly one answer per question (keys 1 through {len(questions)})."
            )

        for answer in payload.answers.values():
            if len(answer) > 5000:
                raise HTTPException(400, "Answer exceeds 5000 characters limit.")

    results = []
    total = 0.0

    # Evaluate each answer according to question type
    for index, question in enumerate(questions, start=1):
        q_type = question.get("type", "question_answer")
        student_answer = payload.answers.get(str(index), "").strip()

        if q_type == "mcq":
            correct_opt = str(question.get("correct_answer", "A")).strip().upper()
            student_opt = student_answer.strip().upper()
            if student_opt and student_opt[0] in ("A", "B", "C", "D"):
                student_opt = student_opt[0]

            is_correct = (student_opt == correct_opt)
            q_score = 100.0 if is_correct else 0.0
            explanation = question.get("explanation", "").strip()
            feedback = (
                f"Correct! {explanation}".strip()
                if is_correct
                else f"Incorrect. The correct option is {correct_opt}. {explanation}".strip()
            )

            evaluation = {
                "score": q_score,
                "feedback": feedback,
                "correct_points": ["Selected the correct option."] if is_correct else [],
                "missing_points": [] if is_correct else [f"Correct answer is {correct_opt}"]
            }
            results.append({
                "question_id": index,
                "question": question["question"],
                "type": "mcq",
                "options": question.get("options", []),
                "your_answer": student_answer,
                "reference_answer": correct_opt,
                **evaluation
            })
        else:
            evaluation = evaluate_answer(
                question["question"],
                question.get("reference_answer", ""),
                question.get("rubric", []),
                student_answer
            )
            q_score = evaluation["score"]
            results.append({
                "question_id": index,
                "question": question["question"],
                "type": "question_answer",
                "your_answer": student_answer,
                "reference_answer": question.get("reference_answer", ""),
                **evaluation
            })

        total += q_score

    percentage = round(total / len(questions), 2)

    with db() as conn:
        # Atomic conditional update prevents concurrent double submission
        cursor = conn.execute("""
            UPDATE assessments
            SET answers_json = ?, score = ?,
                status = 'completed', completed_at = ?,
                auto_submitted = ?
            WHERE id = ? AND (user_id = ? OR user_email = ?)
              AND status = 'in_progress'
        """, (
            json.dumps(results),
            percentage,
            int(time.time()),
            1 if is_auto else 0,
            payload.assessment_id,
            user.id,
            user.email
        ))

        if cursor.rowcount != 1:
            # Re-read completed assessment if another thread completed it concurrently
            row_now = conn.execute("SELECT * FROM assessments WHERE id = ?", (payload.assessment_id,)).fetchone()
            if row_now and row_now["status"] == "completed":
                saved_results = json.loads(row_now["answers_json"]) if row_now["answers_json"] else []
                return {
                    "assessment_id": payload.assessment_id,
                    "score": row_now["score"] or 0,
                    "total_questions": row_now["total_questions"],
                    "question_type": row_now["question_type"] if "question_type" in row_now.keys() else "mixed",
                    "difficulty": row_now["difficulty"] if "difficulty" in row_now.keys() else "medium",
                    "auto_submitted": bool(row_now["auto_submitted"]) if "auto_submitted" in row_now.keys() else False,
                    "results": saved_results
                }
            raise HTTPException(
                409, "Assessment was already submitted."
            )

    return {
        "assessment_id": payload.assessment_id,
        "score": percentage,
        "total_questions": len(questions),
        "question_type": assessment["question_type"] if "question_type" in assessment.keys() else "mixed",
        "difficulty": assessment["difficulty"] if "difficulty" in assessment.keys() else "medium",
        "auto_submitted": bool(is_auto),
        "results": results
    }


# ---------- AI TUTOR ENDPOINTS ----------

class TutorChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    document_id: Optional[int] = None


@router.get("/tutor/documents")
def get_tutor_documents(user: AuthenticatedUser = Depends(current_user)):
    with db() as conn:
        rows = conn.execute("""
            SELECT id, filename, created_at, LENGTH(text_content) as char_count
            FROM user_documents
            WHERE user_id = ? OR user_email = ?
            ORDER BY created_at DESC
        """, (user.id, user.email)).fetchall()
    return {"documents": [dict(r) for r in rows]}


@router.post("/tutor/upload")
async def upload_tutor_document(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(current_user)
):
    text = await read_pdf(file)
    filename = Path(file.filename or "notes.pdf").name
    with db() as conn:
        cursor = conn.execute("""
            INSERT INTO user_documents (user_id, user_email, filename, text_content, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (user.id, user.email, filename, text, int(time.time())))
        doc_id = cursor.lastrowid
    return {
        "success": True,
        "document": {
            "id": doc_id,
            "filename": filename,
            "char_count": len(text)
        }
    }


@router.get("/tutor/history")
def get_tutor_history(user: AuthenticatedUser = Depends(current_user)):
    with db() as conn:
        rows = conn.execute("""
            SELECT id, sender, text, source_file, source_excerpt, created_at
            FROM tutor_messages
            WHERE user_id = ?
            ORDER BY created_at ASC
        """, (user.id,)).fetchall()
    return {"messages": [dict(r) for r in rows]}


@router.post("/tutor/clear")
def clear_tutor_history(user: AuthenticatedUser = Depends(current_user)):
    with db() as conn:
        conn.execute("DELETE FROM tutor_messages WHERE user_id = ?", (user.id,))
    return {"success": True, "message": "Tutor conversation cleared."}


@router.post("/tutor/chat")
def tutor_chat(
    req: TutorChatRequest,
    user: AuthenticatedUser = Depends(current_user)
):
    user_query = req.message.strip()
    with db() as conn:
        if req.document_id:
            doc = conn.execute("""
                SELECT id, filename, text_content FROM user_documents
                WHERE id = ? AND (user_id = ? OR user_email = ?)
            """, (req.document_id, user.id, user.email)).fetchone()
        else:
            doc = conn.execute("""
                SELECT id, filename, text_content FROM user_documents
                WHERE user_id = ? OR user_email = ?
                ORDER BY created_at DESC LIMIT 1
            """, (user.id, user.email)).fetchone()

    if not doc:
        return {
            "reply": "You haven't uploaded any study material yet. Please upload your course PDF or notes first using the button above so I can answer questions grounded in your document.",
            "source": None
        }

    doc_name = doc["filename"]
    doc_text = doc["text_content"]

    # Grounded relevance retrieval: find matching chunks
    keywords = [w.lower() for w in re.findall(r"\w{4,}", user_query)]
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\.\s{2,}", doc_text) if len(p.strip()) > 30]

    scored_paragraphs = []
    for p in paragraphs:
        p_lower = p.lower()
        score = sum(1 for kw in keywords if kw in p_lower)
        scored_paragraphs.append((score, p))
    scored_paragraphs.sort(key=lambda x: x[0], reverse=True)

    if scored_paragraphs and scored_paragraphs[0][0] > 0:
        top_chunks = [p for _, p in scored_paragraphs[:5]]
        context = "\n\n".join(top_chunks)
        source_excerpt = top_chunks[0][:180] + "..."
    else:
        context = doc_text[:8000]
        source_excerpt = doc_text[:180] + "..."

    prompt = f"""You are CogniAgent AI Tutor, a helpful academic tutor.

Answer the student's question based strictly on the study material provided below.
Rules:
- If the study material explains the concept, provide a clear, supportive explanation with examples where applicable.
- If the study material DOES NOT contain enough information to answer the question, state: "Based on your uploaded document ({doc_name}), this topic is not covered in the material." Do NOT fabricate information.
- Format the response in concise, well-structured text.

STUDY MATERIAL ({doc_name}):
{context}

STUDENT QUESTION:
{user_query}
"""

    reply = ask_qwen(prompt, as_json=False)

    now = int(time.time())
    with db() as conn:
        conn.execute("""
            INSERT INTO tutor_messages (user_id, document_id, sender, text, source_file, source_excerpt, created_at)
            VALUES (?, ?, 'user', ?, ?, ?, ?)
        """, (user.id, doc["id"], user_query, doc_name, None, now))
        conn.execute("""
            INSERT INTO tutor_messages (user_id, document_id, sender, text, source_file, source_excerpt, created_at)
            VALUES (?, ?, 'assistant', ?, ?, ?, ?)
        """, (user.id, doc["id"], reply, doc_name, source_excerpt, now + 1))

    return {
        "reply": reply,
        "source": {
            "file": doc_name,
            "excerpt": source_excerpt
        }
    }


# ---------- HISTORY ENDPOINTS ----------

@router.get("/history")
def get_history(user: AuthenticatedUser = Depends(current_user)):
    with db() as conn:
        rows = conn.execute("""
            SELECT id, pdf_name, score, total_questions,
                   question_type, difficulty, duration_minutes,
                   status, created_at, completed_at, auto_submitted
            FROM assessments
            WHERE user_id = ? OR user_email = ?
            ORDER BY created_at DESC
        """, (user.id, user.email)).fetchall()

    return {"history": [dict(row) for row in rows]}


@router.get("/stats")
def get_assessment_stats(user: AuthenticatedUser = Depends(current_user)):
    with db() as conn:
        rows = conn.execute("""
            SELECT id, score, total_questions, status, created_at, completed_at, auto_submitted
            FROM assessments
            WHERE user_id = ? OR user_email = ?
        """, (user.id, user.email)).fetchall()

    total_assessments = len(rows)
    completed = [r for r in rows if r["status"] == "completed" and r["score"] is not None]
    total_completed = len(completed)
    scores = [r["score"] for r in completed]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    highest_score = round(max(scores), 1) if scores else 0.0
    total_questions = sum(r["total_questions"] for r in rows)
    auto_submitted_count = sum(1 for r in rows if r["auto_submitted"])

    return {
        "total_assessments": total_assessments,
        "completed_assessments": total_completed,
        "in_progress_assessments": total_assessments - total_completed,
        "average_score": avg_score,
        "highest_score": highest_score,
        "total_questions_attempted": total_questions,
        "auto_submitted_count": auto_submitted_count,
    }


@router.get("/{assessment_id}")
def get_assessment(
    assessment_id: int,
    user: AuthenticatedUser = Depends(current_user)
):
    with db() as conn:
        row = conn.execute("""
            SELECT * FROM assessments
            WHERE id = ? AND (user_id = ? OR user_email = ?)
        """, (assessment_id, user.id, user.email)).fetchone()

    if not row:
        raise HTTPException(404, "Assessment not found.")

    questions = json.loads(row["questions_json"])
    is_completed = (row["status"] == "completed")
    duration = row["duration_minutes"] if ("duration_minutes" in row.keys() and row["duration_minutes"]) else 15
    started_at = row["started_at"] if "started_at" in row.keys() else None
    deadline = row["deadline"] if "deadline" in row.keys() else None
    now = int(time.time())
    remaining_seconds = max(0, deadline - now) if deadline else int(duration * 60)

    return {
        "assessment_id": row["id"],
        "filename": row["pdf_name"],
        "status": row["status"],
        "score": row["score"],
        "total_questions": row["total_questions"],
        "question_type": row["question_type"] if "question_type" in row.keys() else "mixed",
        "difficulty": row["difficulty"] if "difficulty" in row.keys() else "medium",
        "duration_minutes": duration,
        "started_at": started_at,
        "deadline": deadline,
        "remaining_seconds": remaining_seconds,
        "auto_submitted": bool(row["auto_submitted"]) if "auto_submitted" in row.keys() else False,
        "questions": [
            {
                "id": i + 1,
                "type": q.get("type", "question_answer"),
                "question": q["question"],
                "options": q.get("options") if q.get("type") == "mcq" else None,
                "max_marks": q.get("max_marks", 10)
            }
            for i, q in enumerate(questions)
        ],
        "results": (
            json.loads(row["answers_json"])
            if row["answers_json"] and is_completed else None
        ),
        "created_at": row["created_at"],
        "completed_at": row["completed_at"]
    }


@router.delete("/{assessment_id}")
def delete_assessment(
    assessment_id: int,
    user: AuthenticatedUser = Depends(current_user)
):
    with db() as conn:
        cursor = conn.execute("""
            DELETE FROM assessments
            WHERE id = ? AND (user_id = ? OR user_email = ?)
        """, (assessment_id, user.id, user.email))
        if cursor.rowcount == 0:
            raise HTTPException(404, "Assessment not found.")
    return {"success": True, "message": f"Assessment {assessment_id} deleted successfully."}


init_db()
