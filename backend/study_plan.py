import os
import re
import time
import math
import sqlite3
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

try:
    from backend.assessment_auth import current_user, AuthenticatedUser, DB_PATH
except ImportError:
    from assessment_auth import current_user, AuthenticatedUser, DB_PATH

try:
    from backend.assessment import read_pdf, ask_qwen, parse_model_json, db, MAX_PDF_SIZE
except ImportError:
    from assessment import read_pdf, ask_qwen, parse_model_json, db, MAX_PDF_SIZE

router = APIRouter(prefix="/api/study-plans", tags=["Study Plans"])


def init_study_plan_db():
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS study_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                user_email TEXT NOT NULL,
                document_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                start_date TEXT NOT NULL,
                target_date TEXT NOT NULL,
                daily_hours REAL NOT NULL,
                start_time TEXT NOT NULL,
                learning_level TEXT NOT NULL,
                learning_goal TEXT NOT NULL,
                break_minutes INTEGER NOT NULL,
                include_revision INTEGER DEFAULT 1,
                total_days INTEGER NOT NULL,
                total_hours REAL NOT NULL,
                limitation_note TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_study_plans_user
            ON study_plans(user_id, created_at)
        """)

        # Safe migrations for existing databases
        for col_name, col_type in [
            ("title", "TEXT"),
            ("start_date", "TEXT"),
            ("target_date", "TEXT"),
            ("daily_hours", "REAL"),
            ("start_time", "TEXT"),
            ("learning_level", "TEXT"),
            ("learning_goal", "TEXT"),
            ("break_minutes", "INTEGER"),
            ("include_revision", "INTEGER DEFAULT 1"),
            ("total_days", "INTEGER"),
            ("total_hours", "REAL"),
            ("limitation_note", "TEXT"),
        ]:
            try:
                conn.execute(f"ALTER TABLE study_plans ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError:
                pass

        conn.execute("""
            CREATE TABLE IF NOT EXISTS study_plan_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                day_number INTEGER NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                activity_type TEXT NOT NULL,
                topic TEXT NOT NULL,
                is_completed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_study_plan_tasks_plan
            ON study_plan_tasks(plan_id, day_number)
        """)


# Call DB initializer
init_study_plan_db()


# ---------------- MODELS ----------------

class CreateStudyPlanRequest(BaseModel):
    document_id: int
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    target_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    daily_study_hours: float = Field(..., ge=1.0)
    daily_start_time: str = Field(..., pattern=r"^\d{1,2}:\d{2}$")
    learning_level: str = Field(..., pattern=r"^(Beginner|Intermediate|Advanced)$")
    learning_goal: str = Field(
        ..., pattern=r"^(Exam Preparation|Concept Understanding|Revision|Complete Syllabus)$"
    )
    break_duration_minutes: int = Field(..., ge=5, le=15)
    include_revision: bool = True


class UpdateTaskStatusRequest(BaseModel):
    is_completed: bool


# ---------------- TIME FORMATTING HELPERS ----------------

def minutes_to_ampm(total_minutes: int) -> str:
    """Converts minutes from midnight (0..1439) into '9:00 AM' format."""
    total_minutes = total_minutes % (24 * 60)
    hours = total_minutes // 60
    mins = total_minutes % 60
    period = "AM" if hours < 12 else "PM"
    h12 = hours % 12
    if h12 == 0:
        h12 = 12
    return f"{h12}:{mins:02d} {period}"


def parse_time_to_minutes(time_str: str) -> int:
    """Parses '09:00' or '9:30' into minutes from midnight."""
    parts = time_str.strip().split(":")
    h = int(parts[0])
    m = int(parts[1])
    return (h * 60 + m) % (24 * 60)


# ---------------- SCHEDULE VALIDATOR & ENGINE ----------------

def build_deterministic_day_schedule(
    day_num: int,
    day_date: str,
    raw_tasks: List[Dict[str, Any]],
    start_time_str: str,
    daily_study_minutes: int,
    break_duration_minutes: int,
    include_revision: bool,
    is_final_day: bool,
    fallback_topics: List[str]
) -> List[Dict[str, Any]]:
    """
    Validates, adjusts, and calculates exact start and end times for a single day.
    Guarantees that:
    1. Study + Practice + Revision strictly equals daily_study_minutes.
    2. Breaks are between 5 and 15 minutes and DO NOT count toward study hours.
    3. Proper time progression starting from start_time_str.
    """
    start_minutes = parse_time_to_minutes(start_time_str)

    # Filter and extract study topics vs break requests from LLM
    study_items = []
    for t in raw_tasks:
        act = (t.get("activity_type") or "Study").strip()
        if act.lower() in ["study", "concept", "lecture", "reading"]:
            act_type = "Study"
        elif act.lower() in ["practice", "quiz", "exercises", "problem"]:
            act_type = "Practice"
        elif act.lower() in ["revision", "revise", "review", "summary"]:
            act_type = "Revision"
        elif act.lower() in ["break", "rest"]:
            continue  # We insert breaks predictably
        else:
            act_type = "Study"

        topic_desc = (t.get("topic") or "").strip()
        if not topic_desc:
            topic_desc = fallback_topics[(day_num - 1) % len(fallback_topics)]

        dur = int(t.get("duration_minutes") or 45)
        study_items.append({"activity_type": act_type, "topic": topic_desc, "raw_duration": dur})

    if not study_items:
        # Default fallback structure for the day grounded in topics
        t_name = fallback_topics[(day_num - 1) % len(fallback_topics)]
        study_items = [
            {"activity_type": "Study", "topic": f"In-depth analysis: {t_name}", "raw_duration": daily_study_minutes // 2},
            {"activity_type": "Practice", "topic": f"Application & problem sets: {t_name}", "raw_duration": daily_study_minutes // 3},
        ]
        if include_revision:
            study_items.append({"activity_type": "Revision", "topic": f"Review key principles: {t_name}", "raw_duration": 15})

    # If is_final_day and include_revision is True, ensure a final comprehensive revision session exists
    if is_final_day and include_revision and not any(it["activity_type"] == "Revision" for it in study_items):
        study_items.append({
            "activity_type": "Revision",
            "topic": "Final Comprehensive Syllabus Review & High-Yield Summary",
            "raw_duration": min(30, max(15, daily_study_minutes // 4))
        })
    elif include_revision and not any(it["activity_type"] == "Revision" for it in study_items):
        study_items.append({
            "activity_type": "Revision",
            "topic": f"Daily Review & Formula Recap ({study_items[0]['topic'][:35]})",
            "raw_duration": 15
        })

    # Normalize durations of study items so they sum exactly to daily_study_minutes
    raw_sum = sum(it["raw_duration"] for it in study_items)
    if raw_sum <= 0:
        raw_sum = len(study_items) * 30

    allocated_study_minutes = 0
    final_study_items = []
    for i, it in enumerate(study_items):
        if i == len(study_items) - 1:
            dur = daily_study_minutes - allocated_study_minutes
        else:
            ratio = it["raw_duration"] / raw_sum
            dur = max(10, int(round(ratio * daily_study_minutes)))
            # Don't exceed budget
            if allocated_study_minutes + dur >= daily_study_minutes - 10:
                dur = max(10, daily_study_minutes - allocated_study_minutes - 10)
        dur = max(5, dur)
        allocated_study_minutes += dur
        final_study_items.append({
            "activity_type": it["activity_type"],
            "topic": it["topic"],
            "duration": dur
        })

    # Ensure last item brings total to daily_study_minutes
    diff = daily_study_minutes - sum(x["duration"] for x in final_study_items)
    final_study_items[-1]["duration"] = max(5, final_study_items[-1]["duration"] + diff)

    # Now assemble the chronological timeline with Breaks (5-15 mins) interleaved
    timeline = []
    current_time_cursor = start_minutes

    for idx, item in enumerate(final_study_items):
        # Insert a break before this study session if it's not the first session
        if idx > 0:
            break_mins = min(15, max(5, break_duration_minutes))
            b_start = current_time_cursor
            b_end = b_start + break_mins
            timeline.append({
                "day_number": day_num,
                "date": day_date,
                "start_time": minutes_to_ampm(b_start),
                "end_time": minutes_to_ampm(b_end),
                "duration_minutes": break_mins,
                "activity_type": "Break",
                "topic": "Mental Rest & Refresh (Hydration & Stretch)",
                "is_completed": 0
            })
            current_time_cursor = b_end

        # Add the study activity
        s_start = current_time_cursor
        s_end = s_start + item["duration"]
        timeline.append({
            "day_number": day_num,
            "date": day_date,
            "start_time": minutes_to_ampm(s_start),
            "end_time": minutes_to_ampm(s_end),
            "duration_minutes": item["duration"],
            "activity_type": item["activity_type"],
            "topic": item["topic"],
            "is_completed": 0
        })
        current_time_cursor = s_end

    return timeline


# ---------------- ENDPOINTS ----------------

@router.get("/documents")
def get_user_study_documents(user: AuthenticatedUser = Depends(current_user)):
    """Returns the authenticated student's uploaded documents."""
    with db() as conn:
        rows = conn.execute("""
            SELECT id, filename, created_at, LENGTH(text_content) as char_count
            FROM user_documents
            WHERE user_id = ? OR user_email = ?
            ORDER BY created_at DESC
        """, (user.id, user.email)).fetchall()
    return {"documents": [dict(r) for r in rows]}


@router.post("/upload")
async def upload_study_plan_document(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(current_user)
):
    """Directly uploads and validates a PDF for study plan generation."""
    text = await read_pdf(file)
    filename = Path(file.filename or "study_material.pdf").name
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


@router.post("/generate")
def generate_study_plan(
    req: CreateStudyPlanRequest,
    user: AuthenticatedUser = Depends(current_user)
):
    """
    Validates configuration, extracts PDF content, generates AI schedule via Groq,
    verifies time limits deterministically, and saves plan to SQLite.
    """
    # 1. Validation of business constraints
    if req.daily_study_hours < 1.0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Minimum daily study duration is 1 hour."
        )

    if not (5 <= req.break_duration_minutes <= 15):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Break duration must be between 5 and 15 minutes."
        )

    try:
        start_d = date.fromisoformat(req.start_date)
        target_d = date.fromisoformat(req.target_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid date format. Expected YYYY-MM-DD."
        )

    if target_d <= start_d:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target completion date must be strictly after the start date."
        )

    total_days = (target_d - start_d).days + 1
    if total_days < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target completion date must allow at least 2 study days."
        )

    # 2. Retrieve Document and Verify Ownership
    with db() as conn:
        doc = conn.execute("""
            SELECT id, filename, text_content
            FROM user_documents
            WHERE id = ? AND (user_id = ? OR user_email = ?)
        """, (req.document_id, user.id, user.email)).fetchone()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected document not found or you do not have permission to access it."
        )

    doc_text = doc["text_content"].strip()
    if len(doc_text) < 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected PDF does not contain sufficient text for topic extraction (minimum 200 characters required)."
        )

    daily_study_minutes = int(round(req.daily_study_hours * 60))
    total_study_hours = round(total_days * req.daily_study_hours, 1)

    # 3. Extract fallback topics directly from text in case AI output needs grounding
    lines = [line.strip() for line in doc_text.split("\n") if len(line.strip()) >= 5]
    potential_headings = []
    for l in lines:
        if re.match(r"^(?:unit|chapter|module|section|\d+\.|\b[A-Z\s]{4,30}\b)", l, re.IGNORECASE):
            cleaned = re.sub(r"^(?:unit|chapter|module|section|\d+\.|\bpage\b)\s*", "", l, flags=re.IGNORECASE).strip()
            if 4 <= len(cleaned) <= 60 and cleaned not in potential_headings:
                potential_headings.append(cleaned)
    if not potential_headings:
        # Fallback to key sentence subjects
        potential_headings = [l[:50] for l in lines[:10] if len(l) > 10]
    if not potential_headings:
        potential_headings = [f"Core Concepts of {doc['filename']}"]

    # 4. Generate structured curriculum using Groq AI
    text_sample = doc_text[:14000]
    prompt = f"""You are an expert academic curriculum designer and educational timetable creator.
Create a realistic day-by-day timetable grounded strictly in the provided study material.

DOCUMENT FILENAME: {doc['filename']}
TOTAL STUDY DAYS: {total_days} (From {req.start_date} to {req.target_date})
DAILY STUDY TIME BUDGET: {daily_study_minutes} minutes ({req.daily_study_hours} hours of study)
PREFERRED DAILY START TIME: {req.daily_start_time}
LEARNING LEVEL: {req.learning_level}
LEARNING GOAL: {req.learning_goal}
BREAK DURATION: {req.break_duration_minutes} minutes
INCLUDE REVISION SESSIONS: {req.include_revision}

EXTRACTED DOCUMENT TEXT EXCERPT:
\"\"\"{text_sample}\"\"\"

CRITICAL SCHEDULING RULES:
1. GROUNDED IN DOCUMENT: Use actual topics, chapters, and principles found in the text excerpt. Never invent random subjects.
2. SPREAD ACROSS ALL DAYS: Distribute topics evenly across all {total_days} days. Day 1 starts on {req.start_date}, final day ends on {req.target_date}.
3. TIME BUDGET: For each day, provide 2 to 4 study activities (Study, Practice, Revision). Their total study duration must sum to approximately {daily_study_minutes} minutes.
4. ACTIVITY TYPES:
   - "Study": Deep dive into a specific topic from the text.
   - "Practice": Practice questions or problem sets on the studied topic.
   - "Revision": Recap of key points and formulas.
5. IF MATERIAL IS VERY EXTENSIVE: If the document contains more topics than can comfortably fit into {total_study_hours} hours at a {req.learning_level} level, prioritize the most important core modules and document this in "limitation_note".

Respond ONLY with valid JSON in this exact structure:
{{
  "plan_title": "Study Plan: [Brief descriptive title from document]",
  "limitation_note": null or "Note on coverage prioritization",
  "days": [
    {{
      "day_number": 1,
      "date": "{req.start_date}",
      "tasks": [
        {{
          "activity_type": "Study",
          "topic": "Specific topic from the document",
          "duration_minutes": 45
        }},
        {{
          "activity_type": "Practice",
          "topic": "Exercises on that topic",
          "duration_minutes": 25
        }}
      ]
    }}
  ]
}}"""

    ai_json = None
    try:
        raw_ai_resp = ask_qwen(prompt, as_json=True)
        ai_json = parse_model_json(raw_ai_resp)
    except Exception as ex:
        print(f"[STUDY PLAN AI WARNING] AI model exception: {ex}. Proceeding with deterministic fallback curriculum.", flush=True)

    # 5. Build validated day-by-day timetable
    plan_title = f"Study Plan: {doc['filename']}"
    limitation_note = None

    ai_days_dict = {}
    if ai_json and isinstance(ai_json, dict):
        if ai_json.get("plan_title"):
            plan_title = str(ai_json["plan_title"]).strip()
        limitation_note = ai_json.get("limitation_note")
        days_list = ai_json.get("days") or []
        for d in days_list:
            if isinstance(d, dict) and "day_number" in d:
                ai_days_dict[int(d["day_number"])] = d.get("tasks", [])

    all_tasks = []
    for day_i in range(1, total_days + 1):
        day_date_obj = start_d + timedelta(days=day_i - 1)
        day_date_str = day_date_obj.isoformat()
        raw_day_tasks = ai_days_dict.get(day_i, [])
        is_final = (day_i == total_days)

        day_schedule = build_deterministic_day_schedule(
            day_num=day_i,
            day_date=day_date_str,
            raw_tasks=raw_day_tasks,
            start_time_str=req.daily_start_time,
            daily_study_minutes=daily_study_minutes,
            break_duration_minutes=req.break_duration_minutes,
            include_revision=req.include_revision,
            is_final_day=is_final,
            fallback_topics=potential_headings
        )
        all_tasks.extend(day_schedule)

    now_ts = int(time.time())

    # 6. Save Plan and Tasks to SQLite Database
    with db() as conn:
        config_dump = req.model_dump_json() if hasattr(req, "model_dump_json") else str(req)
        cursor = conn.execute("""
            INSERT INTO study_plans (
                user_id, user_email, document_id, document_name, title,
                start_date, target_date, daily_hours, start_time,
                learning_level, learning_goal, break_minutes, include_revision,
                total_days, total_hours, limitation_note,
                config_json, plan_json, completed_sessions_json, progress_pct,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user.id,
            user.email,
            req.document_id,
            doc["filename"],
            plan_title,
            req.start_date,
            req.target_date,
            req.daily_study_hours,
            req.daily_start_time,
            req.learning_level,
            req.learning_goal,
            req.break_duration_minutes,
            1 if req.include_revision else 0,
            total_days,
            total_study_hours,
            limitation_note,
            config_dump,
            "[]",
            "[]",
            0.0,
            now_ts,
            now_ts
        ))
        plan_id = cursor.lastrowid

        # Insert tasks
        task_rows = []
        for t in all_tasks:
            task_cursor = conn.execute("""
                INSERT INTO study_plan_tasks (
                    plan_id, day_number, date, start_time, end_time,
                    duration_minutes, activity_type, topic, is_completed, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                plan_id,
                t["day_number"],
                t["date"],
                t["start_time"],
                t["end_time"],
                t["duration_minutes"],
                t["activity_type"],
                t["topic"],
                t["is_completed"],
                now_ts
            ))
            t["id"] = task_cursor.lastrowid
            task_rows.append(t)

    return {
        "success": True,
        "plan": {
            "id": plan_id,
            "title": plan_title,
            "document_id": req.document_id,
            "filename": doc["filename"],
            "start_date": req.start_date,
            "target_date": req.target_date,
            "daily_hours": req.daily_study_hours,
            "start_time": req.daily_start_time,
            "learning_level": req.learning_level,
            "learning_goal": req.learning_goal,
            "break_minutes": req.break_duration_minutes,
            "include_revision": req.include_revision,
            "total_days": total_days,
            "total_hours": total_study_hours,
            "limitation_note": limitation_note,
            "created_at": now_ts,
            "tasks": task_rows,
            "stats": {
                "total_tasks": len(task_rows),
                "completed_tasks": 0,
                "progress_percentage": 0.0
            }
        }
    }


@router.get("/latest")
def get_latest_study_plan(user: AuthenticatedUser = Depends(current_user)):
    """Retrieves the latest saved study plan with its tasks for the student."""
    with db() as conn:
        plan_row = conn.execute("""
            SELECT p.*, d.filename
            FROM study_plans p
            LEFT JOIN user_documents d ON p.document_id = d.id
            WHERE p.user_id = ? OR p.user_email = ?
            ORDER BY p.created_at DESC
            LIMIT 1
        """, (user.id, user.email)).fetchone()

        if not plan_row:
            return {"plan": None}

        plan_dict = dict(plan_row)
        plan_id = plan_dict["id"]

        tasks = conn.execute("""
            SELECT id, day_number, date, start_time, end_time,
                   duration_minutes, activity_type, topic, is_completed
            FROM study_plan_tasks
            WHERE plan_id = ?
            ORDER BY day_number ASC, id ASC
        """, (plan_id,)).fetchall()

    task_list = [dict(t) for t in tasks]
    total_tasks = len(task_list)
    completed_tasks = sum(1 for t in task_list if t["is_completed"] == 1)
    progress_pct = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    plan_dict["tasks"] = task_list
    plan_dict["stats"] = {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percentage": progress_pct
    }
    return {"plan": plan_dict}


@router.get("/{plan_id}")
def get_study_plan_by_id(
    plan_id: int,
    user: AuthenticatedUser = Depends(current_user)
):
    """Retrieves a specific study plan by ID with ownership enforcement."""
    with db() as conn:
        plan_row = conn.execute("""
            SELECT p.*, d.filename
            FROM study_plans p
            LEFT JOIN user_documents d ON p.document_id = d.id
            WHERE p.id = ? AND (p.user_id = ? OR p.user_email = ?)
        """, (plan_id, user.id, user.email)).fetchone()

        if not plan_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study plan not found or access denied."
            )

        plan_dict = dict(plan_row)
        tasks = conn.execute("""
            SELECT id, day_number, date, start_time, end_time,
                   duration_minutes, activity_type, topic, is_completed
            FROM study_plan_tasks
            WHERE plan_id = ?
            ORDER BY day_number ASC, id ASC
        """, (plan_id,)).fetchall()

    task_list = [dict(t) for t in tasks]
    total_tasks = len(task_list)
    completed_tasks = sum(1 for t in task_list if t["is_completed"] == 1)
    progress_pct = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    plan_dict["tasks"] = task_list
    plan_dict["stats"] = {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percentage": progress_pct
    }
    return {"plan": plan_dict}


@router.patch("/tasks/{task_id}")
def update_task_completion_status(
    task_id: int,
    req: UpdateTaskStatusRequest,
    user: AuthenticatedUser = Depends(current_user)
):
    """
    Updates completion status of a task, verifying that the task's plan belongs to the student.
    """
    with db() as conn:
        # Check task exists and plan belongs to user
        row = conn.execute("""
            SELECT t.id, t.plan_id, p.user_id, p.user_email
            FROM study_plan_tasks t
            JOIN study_plans p ON t.plan_id = p.id
            WHERE t.id = ?
        """, (task_id,)).fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found."
            )

        if row["user_id"] != user.id and row["user_email"] != user.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this task."
            )

        plan_id = row["plan_id"]
        new_val = 1 if req.is_completed else 0

        conn.execute("""
            UPDATE study_plan_tasks
            SET is_completed = ?
            WHERE id = ?
        """, (new_val, task_id))

        # Fetch updated statistics for the plan
        stats_row = conn.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM study_plan_tasks
            WHERE plan_id = ?
        """, (plan_id,)).fetchone()

    total = stats_row["total"] or 0
    completed = stats_row["completed"] or 0
    progress_pct = round((completed / total * 100), 1) if total > 0 else 0.0

    return {
        "success": True,
        "task_id": task_id,
        "is_completed": bool(req.is_completed),
        "stats": {
            "total_tasks": total,
            "completed_tasks": completed,
            "progress_percentage": progress_pct
        }
    }


@router.delete("/{plan_id}")
def delete_study_plan(
    plan_id: int,
    user: AuthenticatedUser = Depends(current_user)
):
    """Deletes a study plan and associated tasks."""
    with db() as conn:
        row = conn.execute("""
            SELECT id FROM study_plans
            WHERE id = ? AND (user_id = ? OR user_email = ?)
        """, (plan_id, user.id, user.email)).fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study plan not found or access denied."
            )

        conn.execute("DELETE FROM study_plan_tasks WHERE plan_id = ?", (plan_id,))
        conn.execute("DELETE FROM study_plans WHERE id = ?", (plan_id,))

    return {"success": True, "message": "Study plan deleted."}
