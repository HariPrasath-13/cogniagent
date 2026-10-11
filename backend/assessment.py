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



# ---------- LOCAL QWEN MODEL RESOLUTION & CALL ----------

def get_effective_model() -> str:
    """
    Checks configured model (defaults to qwen2.5:3b).
    If another Qwen model is available locally in Ollama, selects the best matching model.
    """
    target = DEFAULT_MODEL_NAME
    try:
        tags_resp = requests.get("http://127.0.0.1:11434/api/tags", timeout=2)
        if tags_resp.ok:
            available = [m.get("name", "") for m in tags_resp.json().get("models", [])]
            # Exact match
            if target in available:
                return target
            # Prefix match e.g. qwen2.5:3b-instruct vs qwen2.5:3b
            for m in available:
                if m.startswith(target) or target.startswith(m):
                    return m
            # If target not yet ready, use installed qwen variant if available
            for m in available:
                if "qwen" in m.lower():
                    return m
            if available:
                return available[0]
    except Exception:
        pass
    return target


def ask_qwen(prompt: str, as_json: bool = True) -> str:
    model = get_effective_model()
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1 if as_json else 0.4,
            "num_ctx": 4096,
            "num_predict": 1200 if as_json else 600
        }
    }
    if as_json:
        payload["format"] = "json"

    t0 = time.time()
    print(f"[OLLAMA] Calling {model} (prompt_len={len(prompt)}, as_json={as_json})...", flush=True)

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=300
        )
        response.raise_for_status()
        data = response.json()
        elapsed = time.time() - t0
        print(f"[OLLAMA] Response received in {elapsed:.2f}s", flush=True)

        result = data.get("response", "").strip()
        # Fallback to thinking field if model output was captured there
        if not result and data.get("thinking"):
            result = data.get("thinking", "").strip()
        result = re.sub(r"<think>.*?</think>", "", result, flags=re.DOTALL).strip()
        return result

    except requests.exceptions.ConnectionError:
        raise HTTPException(
            503,
            f"Local AI model is unavailable. Please ensure Ollama is running ('ollama serve') with model {model}."
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            504,
            "AI processing timed out. Try uploading a smaller PDF or asking for fewer questions (e.g. 3 questions)."
        )
    except (requests.RequestException, KeyError, ValueError) as err:
        raise HTTPException(
            502, f"The AI model returned an invalid response: {str(err)}"
        )




def parse_model_json(text: str):
    text = text.strip()
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

        text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Unable to read this PDF file. The file may be corrupted.")

    text = re.sub(r"\s+", " ", text).strip()

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

    # Smart representative context extraction:
    # Sampling informative paragraphs up to 3,500 characters keeps CPU prompt eval to ~15-20 seconds.
    if len(text) <= 3500:
        source = text
    else:
        paras = [p.strip() for p in text.split("\n") if len(p.strip()) > 30]
        selected = []
        curr_len = 0
        for p in paras:
            if curr_len + len(p) > 3500:
                break
            selected.append(p)
            curr_len += len(p)
        source = "\n\n".join(selected) if selected else text[:3500]

    diff_guidelines = {
        "easy": "DIFFICULTY LEVEL: EASY. Test foundational definitions, explicit facts, direct recall, and straightforward concepts explicitly stated in the source text.",
        "medium": "DIFFICULTY LEVEL: MEDIUM. Test conceptual understanding, comparisons, practical applications, cause-and-effect relationships, and key concepts.",
        "hard": "DIFFICULTY LEVEL: HARD. Test deep analytical reasoning, edge cases, trade-offs, critical evaluation, and multi-concept synthesis from the source text."
    }
    diff_instruction = diff_guidelines.get(diff, diff_guidelines["medium"])

    if q_type == "mcq":
        prompt = f"""You are an educational assessment generator.

Create exactly {count} multiple-choice questions (MCQs) based ONLY on the source text below.
{diff_instruction}

STRICT REQUIREMENTS FOR EACH MCQ:
- Provide 4 distinct options formatted as ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"].
- Exactly ONE option must be correct. The remaining three must be plausible distractors grounded in the topic.
- "correct_answer" MUST be the single uppercase letter: "A", "B", "C", or "D".
- "explanation" must concisely explain why the correct option is right based on the source text (1-2 sentences).

Return valid JSON in this exact structure:
{{
  "questions": [
    {{
      "question": "Clear question directly answerable from the source?",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "Why this answer is correct."
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
    print(f"[ASSESSMENT GEN] [Stage 4/6] Sending prompt to Ollama (source_len={len(source)}, count={count}, type={q_type}, diff={diff})", flush=True)

    raw_response = ask_qwen(prompt, as_json=True)
    elapsed = time.time() - t0
    print(f"[ASSESSMENT GEN] [Stage 5/6] Ollama inference response received in {elapsed:.2f}s", flush=True)

    data = parse_model_json(raw_response)
    raw_questions = data.get("questions", [])

    if not isinstance(raw_questions, list):
        raise HTTPException(502, "Invalid question list returned from the AI model.")

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
            opts = options if isinstance(options, list) else []
            if len(opts) < 4:
                # Ensure 4 options exist
                defaults = ["Option A", "Option B", "Option C", "Option D"]
                opts = opts + defaults[len(opts):]
            opts = [str(o)[:200] for o in opts[:4]]

            corr = str(item.get("correct_answer", "A")).strip().upper()
            if corr and corr[0] in ("A", "B", "C", "D"):
                corr = corr[0]
            else:
                corr = "A"

            explanation = str(item.get("explanation", "")).strip()
            seen.add(q_text.lower())
            questions.append({
                "type": "mcq",
                "question": q_text,
                "options": opts,
                "correct_answer": corr,
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
