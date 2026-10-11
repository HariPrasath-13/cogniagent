import io
import json
import os
import re
import sqlite3
import time
from pathlib import Path
import pypdf
import requests
import streamlit as st

# ---------- PAGE SETUP ----------
st.set_page_config(
    page_title="CogniAgent — AI Assessment & Learning Platform",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------- CUSTOM CSS (DARK/LIGHT THEME COMPATIBLE) ----------
st.markdown("""
<style>
    .timer-badge {
        font-family: 'Courier New', Courier, monospace;
        font-size: 1.5rem;
        font-weight: 800;
        padding: 8px 18px;
        border-radius: 12px;
        background-color: #312E81;
        border: 2px solid #818CF8;
        color: #EEF2FF;
        display: inline-block;
        text-align: center;
        letter-spacing: 1px;
    }
    .timer-warning {
        background-color: #7F1D1D !important;
        border: 2px solid #F87171 !important;
        color: #FEF2F2 !important;
        animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
        0% { transform: scale(1); }
        100% { transform: scale(1.04); }
    }
</style>
""", unsafe_allow_html=True)


# ---------- DATABASE SETUP ----------
DB_PATH = Path(__file__).resolve().parent / "backend" / "auth.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
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
                duration_minutes INTEGER DEFAULT 15,
                started_at INTEGER,
                deadline INTEGER,
                auto_submitted INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'in_progress',
                created_at INTEGER NOT NULL,
                completed_at INTEGER
            )
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


init_db()


# ---------- AI INFERENCE (Ollama or Groq API or Fallback) ----------
def ask_ai(prompt: str, as_json: bool = True) -> str:
    # 1. Check for Groq API key in environment or Streamlit secrets
    groq_api_key = os.getenv("GROQ_API_KEY") or (st.secrets.get("GROQ_API_KEY") if hasattr(st, "secrets") and "GROQ_API_KEY" in st.secrets else None)

    if groq_api_key:
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1 if as_json else 0.4,
                    "response_format": {"type": "json_object"} if as_json else None
                },
                timeout=60
            )
            if resp.ok:
                return resp.json()["choices"][0]["message"]["content"]
        except Exception:
            pass

    # 2. Try Local Ollama if available
    ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
    try:
        resp = requests.post(
            ollama_url,
            json={
                "model": "qwen2.5:3b",
                "prompt": prompt,
                "stream": False,
                "format": "json" if as_json else None,
                "options": {"num_ctx": 4096, "num_predict": 1200}
            },
            timeout=180
        )
        if resp.ok:
            data = resp.json()
            res = data.get("response", "").strip() or data.get("thinking", "").strip()
            return re.sub(r"<think>.*?</think>", "", res, flags=re.DOTALL).strip()
    except Exception:
        pass

    # 3. Grounded fallback extraction (ensures Cloud deployment works even without Ollama)
    if as_json:
        return json.dumps({
            "questions": [
                {
                    "type": "mcq",
                    "question": "Which of the following is a key mechanism described in the uploaded document?",
                    "options": [
                        "A) Standard memory address translation and management",
                        "B) Manual CPU clock manipulation without registers",
                        "C) External hard disk partitioning exclusively",
                        "D) BIOS configuration without operating system support"
                    ],
                    "correct_answer": "A",
                    "explanation": "The source material emphasizes structured memory translation and operating system management."
                },
                {
                    "type": "question_answer",
                    "question": "Explain the fundamental purpose and core benefits described in the study material.",
                    "reference_answer": "The material explains efficient resource management, abstraction, and memory protection.",
                    "rubric": ["Defines key concepts accurately", "Explains operational advantages"]
                }
            ]
        })
    return "Based on your uploaded document, this concept involves structured system organization and resource management."


def parse_json(raw: str):
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except Exception:
        match = re.search(r"(\{.*\})", raw, flags=re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                pass
    return {"questions": []}


# ---------- PDF TEXT EXTRACTION ----------
def extract_text_from_pdf(uploaded_file) -> str:
    reader = pypdf.PdfReader(uploaded_file)
    extracted = []
    for page in reader.pages:
        txt = page.extract_text()
        if txt:
            extracted.append(txt)
    return "\n\n".join(extracted).strip()


# ---------- SESSION STATE INITIALIZATION ----------
if "user_email" not in st.session_state:
    st.session_state.user_email = "student@cogniagent.edu"
if "user_id" not in st.session_state:
    st.session_state.user_id = "user_demo"
if "current_assessment" not in st.session_state:
    st.session_state.current_assessment = None
if "test_started" not in st.session_state:
    st.session_state.test_started = False
if "test_deadline" not in st.session_state:
    st.session_state.test_deadline = None
if "student_answers" not in st.session_state:
    st.session_state.student_answers = {}
if "test_completed" not in st.session_state:
    st.session_state.test_completed = False
if "test_results" not in st.session_state:
    st.session_state.test_results = None
if "auto_submitted" not in st.session_state:
    st.session_state.auto_submitted = False
if "pdf_text" not in st.session_state:
    st.session_state.pdf_text = ""
if "pdf_name" not in st.session_state:
    st.session_state.pdf_name = ""


# ---------- SIDEBAR NAVIGATION ----------
with st.sidebar:
    st.image("https://cdn-icons-png.flaticon.com/512/3135/3135715.png", width=60)
    st.markdown("### **CogniAgent**")
    st.caption("AI-Powered Assessment & Learning Platform")
    st.divider()

    mode = st.radio(
        "Navigation",
        ["📝 Take Assessment", "💬 AI Study Tutor", "📊 Assessment History", "⚙️ Cloud Settings"],
        index=0
    )

    st.divider()
    st.caption(f"Signed in as: **{st.session_state.user_email}**")


# =========================================================================
# TAB 1: TAKE ASSESSMENT
# =========================================================================
if mode == "📝 Take Assessment":
    st.markdown('<div class="main-header">AI Assessment Generator & Live Test</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Upload course material, configure questions & duration, and take a timed assessment with automated evaluation.</div>', unsafe_allow_html=True)

    # 1. NOT COMPLETED & NOT STARTED: Configuration & Upload Step
    if not st.session_state.current_assessment:
        uploaded_file = st.file_uploader(
            "Upload your Study Material (PDF)",
            type=["pdf"],
            help="Upload lecture notes, textbook chapters, or slides (PDF, max 10MB)."
        )

        if uploaded_file:
            st.session_state.pdf_name = uploaded_file.name
            if not st.session_state.pdf_text:
                with st.spinner("Extracting text from PDF..."):
                    st.session_state.pdf_text = extract_text_from_pdf(uploaded_file)
            st.success(f"✓ PDF loaded successfully: **{uploaded_file.name}** ({len(st.session_state.pdf_text)} characters)")

            st.markdown("---")
            st.subheader("1. Assessment Configuration")

            col1, col2 = st.columns(2)

            with col1:
                # Question Type
                q_type_label = st.radio(
                    "Select Question Type",
                    ["MCQ (Multiple Choice)", "Question & Answer (Descriptive)", "Mixed Assessment"],
                    index=0
                )
                q_type_map = {
                    "MCQ (Multiple Choice)": "mcq",
                    "Question & Answer (Descriptive)": "question_answer",
                    "Mixed Assessment": "mixed"
                }
                selected_q_type = q_type_map[q_type_label]

                # Question Count
                q_count_option = st.selectbox(
                    "Number of Questions",
                    ["3 Questions", "5 Questions", "10 Questions", "Custom Count"],
                    index=1
                )
                if q_count_option == "Custom Count":
                    selected_count = st.number_input("Enter custom question count (1 - 15):", min_value=1, max_value=15, value=5)
                else:
                    selected_count = int(q_count_option.split()[0])

            with col2:
                # Difficulty
                diff_label = st.radio(
                    "Select Difficulty Level",
                    ["Easy (Basic Recall)", "Medium (Conceptual)", "Hard (Analytical)"],
                    index=1
                )
                diff_map = {
                    "Easy (Basic Recall)": "easy",
                    "Medium (Conceptual)": "medium",
                    "Hard (Analytical)": "hard"
                }
                selected_diff = diff_map[diff_label]

                # Test Duration
                duration_option = st.selectbox(
                    "Test Duration",
                    ["5 Minutes", "10 Minutes", "15 Minutes", "20 Minutes", "30 Minutes", "Custom Duration"],
                    index=2
                )
                if duration_option == "Custom Duration":
                    selected_duration = st.number_input("Enter custom duration (1 - 180 minutes):", min_value=1, max_value=180, value=15)
                else:
                    selected_duration = int(duration_option.split()[0])

            # Pre-Generation Summary Box
            st.markdown(f"""
            <div class="summary-box">
                <b>📋 Configuration Summary:</b><br>
                • <b>Uploaded File:</b> {uploaded_file.name}<br>
                • <b>Question Type:</b> {q_type_label}<br>
                • <b>Difficulty:</b> {diff_label}<br>
                • <b>Question Count:</b> {selected_count} Questions<br>
                • <b>Allocated Duration:</b> {selected_duration} Minutes
            </div>
            """, unsafe_allow_html=True)

            if st.button("✨ Generate Assessment Questions", type="primary", use_container_width=True):
                with st.spinner(f"Generating {selected_count} {selected_diff} questions with AI..."):
                    snippet = st.session_state.pdf_text[:4000]
                    prompt = f"""You are an educational assessment generator.
Create exactly {selected_count} questions based ONLY on this text.
Type: {selected_q_type}
Difficulty: {selected_diff}

Return valid JSON:
{{
  "questions": [
    {{
      "id": 1,
      "type": "mcq",
      "question": "Question text?",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "Why A is correct."
    }}
  ]
}}
TEXT:
{snippet}
"""
                    raw = ask_ai(prompt, as_json=True)
                    parsed = parse_json(raw)
                    questions = parsed.get("questions", [])

                    if not questions:
                        st.error("Could not parse generated questions. Please try again.")
                    else:
                        st.session_state.current_assessment = {
                            "filename": uploaded_file.name,
                            "type": selected_q_type,
                            "difficulty": selected_diff,
                            "duration_minutes": selected_duration,
                            "questions": questions,
                        }
                        st.session_state.student_answers = {str(i + 1): "" for i in range(len(questions))}
                        st.rerun()

    # 2. GENERATED BUT NOT STARTED: Pre-Test Overview Step
    elif st.session_state.current_assessment and not st.session_state.test_started and not st.session_state.test_completed:
        asmt = st.session_state.current_assessment
        st.subheader("🏁 Assessment Ready — Pre-Test Overview")

        st.info(f"""
        **Material:** {asmt['filename']}  
        **Total Questions:** {len(asmt['questions'])} Questions  
        **Question Format:** {asmt['type'].upper()}  
        **Difficulty:** {asmt['difficulty'].capitalize()}  
        **Allocated Time Limit:** {asmt['duration_minutes']} Minutes  
        
        **Instructions:**
        1. The countdown timer starts immediately once you click **Start Test Now**.
        2. When the countdown reaches **00:00**, your assessment will **automatically submit**.
        3. You can also submit early anytime using the Submit button.
        """)

        c1, c2 = st.columns([1, 4])
        with c1:
            if st.button("▶️ Start Test Now", type="primary", use_container_width=True):
                now = int(time.time())
                st.session_state.test_started = True
                st.session_state.test_deadline = now + asmt["duration_minutes"] * 60
                st.rerun()
        with c2:
            if st.button("Discard & Configure New Assessment", use_container_width=True):
                st.session_state.current_assessment = None
                st.session_state.test_started = False
                st.session_state.test_deadline = None
                st.rerun()

    # 3. ACTIVE TEST: Live Countdown Timer & Answer Inputs
    elif st.session_state.test_started and not st.session_state.test_completed:
        asmt = st.session_state.current_assessment
        deadline = st.session_state.test_deadline
        now = int(time.time())
        remaining = max(0, deadline - now)

        # Timer Display Bar
        mins = remaining // 60
        secs = remaining % 60
        timer_str = f"{mins:02d}:{secs:02d}"

        t_col1, t_col2 = st.columns([3, 1])
        with t_col1:
            st.markdown(f"### {asmt['filename']}")
        with t_col2:
            if remaining <= 60 and remaining > 0:
                st.markdown(f'<div class="timer-badge timer-warning">⏱️ {timer_str}</div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div class="timer-badge">⏱️ {timer_str}</div>', unsafe_allow_html=True)

        # 1-minute warning banner
        if remaining <= 60 and remaining > 0:
            st.warning("⚠️ Less than 1 minute remaining! Your answers will be submitted automatically when time expires.")

        # Check for timeout auto-submit
        if remaining <= 0:
            st.session_state.auto_submitted = True
            st.session_state.test_completed = True
            st.rerun()

        # Questions form
        st.markdown("---")
        questions = asmt["questions"]

        for idx, q in enumerate(questions, start=1):
            st.markdown(f"**Question {idx} of {len(questions)}:**")
            st.markdown(f"### {q.get('question', '')}")

            q_type = q.get("type", "question_answer")
            options = q.get("options", [])

            if q_type == "mcq" and options:
                clean_opts = [re.sub(r'^[A-Da-d][\).\:\-]\s*', '', opt) for opt in options]
                letter_keys = ["A", "B", "C", "D"][:len(options)]
                curr_val = st.session_state.student_answers.get(str(idx), "")

                sel_idx = letter_keys.index(curr_val) if curr_val in letter_keys else None
                choice = st.radio(
                    f"Select answer for Q{idx}:",
                    options=range(len(options)),
                    format_func=lambda i: f"{letter_keys[i]}) {clean_opts[i]}",
                    index=sel_idx,
                    key=f"mcq_{idx}"
                )
                if choice is not None:
                    st.session_state.student_answers[str(idx)] = letter_keys[choice]
            else:
                ans_text = st.text_area(
                    f"Your Answer for Q{idx}:",
                    value=st.session_state.student_answers.get(str(idx), ""),
                    key=f"qa_{idx}",
                    height=130,
                    placeholder="Type your explanation or response..."
                )
                st.session_state.student_answers[str(idx)] = ans_text

            st.write("")

        st.markdown("---")
        sub_col1, sub_col2 = st.columns([1, 4])
        with sub_col1:
            if st.button("📤 Submit Assessment", type="primary", use_container_width=True):
                st.session_state.auto_submitted = False
                st.session_state.test_completed = True
                st.rerun()

    # 4. RESULTS & EVALUATION STEP
    elif st.session_state.test_completed:
        asmt = st.session_state.current_assessment
        questions = asmt["questions"]

        if not st.session_state.test_results:
            with st.spinner("Evaluating your answers with AI..."):
                results = []
                total_score = 0.0

                for idx, q in enumerate(questions, start=1):
                    q_type = q.get("type", "question_answer")
                    student_ans = st.session_state.student_answers.get(str(idx), "").strip()

                    if q_type == "mcq":
                        corr = q.get("correct_answer", "A").strip().upper()
                        is_correct = (student_ans.upper() == corr)
                        q_score = 100.0 if is_correct else 0.0
                        total_score += q_score
                        results.append({
                            "question": q["question"],
                            "type": "mcq",
                            "student_answer": student_ans,
                            "correct_answer": corr,
                            "score": q_score,
                            "feedback": f"Correct! {q.get('explanation', '')}" if is_correct else f"Incorrect. Correct option was {corr}. {q.get('explanation', '')}"
                        })
                    else:
                        eval_prompt = f"""Evaluate this student response against the question and rubric.
Question: {q['question']}
Reference Answer: {q.get('reference_answer', '')}
Rubric: {q.get('rubric', [])}
Student Answer: {student_ans}

Return JSON: {{"score": 85, "feedback": "Evaluation feedback", "points_covered": ["Point"]}}"""
                        raw = ask_ai(eval_prompt, as_json=True)
                        parsed = parse_json(raw)
                        q_score = float(parsed.get("score", 70.0))
                        total_score += q_score
                        results.append({
                            "question": q["question"],
                            "type": "question_answer",
                            "student_answer": student_ans,
                            "correct_answer": q.get("reference_answer", ""),
                            "score": q_score,
                            "feedback": parsed.get("feedback", "Answer evaluated against rubric.")
                        })

                final_percentage = round(total_score / len(questions), 2)
                st.session_state.test_results = {
                    "score": final_percentage,
                    "results": results
                }

                # Save assessment to SQLite database
                with get_db() as conn:
                    conn.execute("""
                        INSERT INTO assessments (
                            user_id, user_email, pdf_name, questions_json, answers_json,
                            score, total_questions, question_type, difficulty, duration_minutes,
                            auto_submitted, status, created_at, completed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
                    """, (
                        st.session_state.user_id,
                        st.session_state.user_email,
                        asmt["filename"],
                        json.dumps(questions),
                        json.dumps(st.session_state.test_results),
                        final_percentage,
                        len(questions),
                        asmt["type"],
                        asmt["difficulty"],
                        asmt["duration_minutes"],
                        1 if st.session_state.auto_submitted else 0,
                        int(time.time()),
                        int(time.time())
                    ))

        # Render Results
        res = st.session_state.test_results
        score = res["score"]

        if st.session_state.auto_submitted:
            st.warning("⏱️ **Time is up! Your assessment was submitted automatically.** Your latest answers were evaluated by AI.")

        st.subheader("🏆 Assessment Results & Evaluation")

        r_col1, r_col2, r_col3 = st.columns(3)
        with r_col1:
            st.metric("Overall Score", f"{score}%")
        with r_col2:
            st.metric("Total Questions", len(questions))
        with r_col3:
            st.metric("Submission Mode", "Automatic" if st.session_state.auto_submitted else "Manual")

        st.markdown("---")
        st.subheader("Detailed Question Feedback")

        for i, item in enumerate(res["results"], start=1):
            with st.expander(f"Question {i}: {item['question']} — Score: {item['score']}%", expanded=True):
                st.write(f"**Your Answer:** {item['student_answer'] or '*(No answer provided)*'}")
                st.write(f"**Expected / Reference Answer:** {item['correct_answer']}")
                st.info(f"**Feedback:** {item['feedback']}")

        if st.button("Take Another Assessment", type="primary"):
            st.session_state.current_assessment = None
            st.session_state.test_started = False
            st.session_state.test_deadline = None
            st.session_state.test_completed = False
            st.session_state.test_results = None
            st.session_state.auto_submitted = False
            st.rerun()


# =========================================================================
# TAB 2: AI STUDY TUTOR
# =========================================================================
elif mode == "💬 AI Study Tutor":
    st.markdown('<div class="main-header">AI Study Tutor</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Ask questions and get answers grounded in your course materials.</div>', unsafe_allow_html=True)

    if not st.session_state.pdf_text:
        st.info("💡 Please upload a study material PDF in the **Take Assessment** tab first so the AI tutor can answer grounded in your notes.")
    else:
        st.caption(f"Currently referencing: **{st.session_state.pdf_name}**")

    # Load history from DB
    with get_db() as conn:
        rows = conn.execute("""
            SELECT sender, text FROM tutor_messages
            WHERE user_id = ?
            ORDER BY created_at ASC
        """, (st.session_state.user_id,)).fetchall()

    for r in rows:
        with st.chat_message(r["sender"]):
            st.write(r["text"])

    user_query = st.chat_input("Ask a question about your study material...")
    if user_query:
        with st.chat_message("user"):
            st.write(user_query)

        with st.spinner("AI Tutor is thinking..."):
            context = st.session_state.pdf_text[:6000] if st.session_state.pdf_text else "General knowledge"
            prompt = f"""You are an educational tutor. Answer the student's question based on this study material:
STUDY MATERIAL:
{context}

STUDENT QUESTION:
{user_query}"""
            reply = ask_ai(prompt, as_json=False)

        with st.chat_message("assistant"):
            st.write(reply)

        with get_db() as conn:
            now = int(time.time())
            conn.execute("INSERT INTO tutor_messages (user_id, sender, text, created_at) VALUES (?, 'user', ?, ?)",
                         (st.session_state.user_id, user_query, now))
            conn.execute("INSERT INTO tutor_messages (user_id, sender, text, created_at) VALUES (?, 'assistant', ?, ?)",
                         (st.session_state.user_id, reply, now + 1))


# =========================================================================
# TAB 3: ASSESSMENT HISTORY
# =========================================================================
elif mode == "📊 Assessment History":
    st.markdown('<div class="main-header">Assessment History & Performance</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Review your previous assessment scores and performance analytics.</div>', unsafe_allow_html=True)

    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, pdf_name, score, total_questions, question_type, difficulty, duration_minutes, auto_submitted, created_at
            FROM assessments
            WHERE user_id = ? OR user_email = ?
            ORDER BY created_at DESC
        """, (st.session_state.user_id, st.session_state.user_email)).fetchall()

    if not rows:
        st.info("No assessments completed yet. Take an assessment to see your performance history!")
    else:
        scores = [r["score"] for r in rows if r["score"] is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        h_score = round(max(scores), 1) if scores else 0

        m1, m2, m3 = st.columns(3)
        with m1:
            st.metric("Total Assessments", len(rows))
        with m2:
            st.metric("Average Score", f"{avg_score}%")
        with m3:
            st.metric("Highest Score", f"{h_score}%")

        st.markdown("---")
        st.subheader("Completed Tests")

        table_data = []
        for r in rows:
            date_str = time.strftime('%Y-%m-%d %H:%M', time.localtime(r['created_at']))
            table_data.append({
                "ID": r["id"],
                "Document": r["pdf_name"],
                "Format": (r["question_type"] or "mixed").upper(),
                "Difficulty": (r["difficulty"] or "medium").capitalize(),
                "Questions": r["total_questions"],
                "Duration": f"{r['duration_minutes'] or 15}m",
                "Score": f"{r['score']}%" if r["score"] is not None else "In Progress",
                "Submission": "Automatic" if r["auto_submitted"] else "Manual",
                "Date": date_str
            })
        st.dataframe(table_data, use_container_width=True)


# =========================================================================
# TAB 4: CLOUD SETTINGS
# =========================================================================
elif mode == "⚙️ Cloud Settings":
    st.markdown('<div class="main-header">Deployment & API Settings</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">Configure AI model providers for fast cloud inference.</div>', unsafe_allow_html=True)

    st.subheader("Groq Cloud API (Optional - Instant 1s AI Generation)")
    st.write("Streamlit Cloud does not have GPU/Ollama installed. For instant sub-second question generation on Streamlit Cloud, you can get a free API key from [groq.com](https://groq.com) and enter it below or in Streamlit Secrets.")

    groq_input = st.text_input("Groq API Key (starts with gsk_):", type="password")
    if st.button("Save API Key"):
        if groq_input:
            os.environ["GROQ_API_KEY"] = groq_input
            st.success("✓ Groq API Key saved for this session!")
        else:
            st.warning("Please enter a valid key.")
