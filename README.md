# AI Interviewer Assistant
A local-first adaptive technical interview simulator for a React + Node full‑stack role.

## ✨ Core Capabilities
| Area | Description |
|------|-------------|
| Resume Intake | Drag & drop PDF / DOCX. Extracts basic Name, Email, Phone (regex heuristics). Missing pieces requested before starting. |
| Adaptive Flow | 6 questions: 2 Easy → 2 Medium → 2 Hard. Each timed (20s / 60s / 120s). Auto-submit on timeout. |
| AI Integration (Optional) | OpenAI can generate questions, score answers (0–100 + feedback), and produce a final summary. Falls back to deterministic placeholders if no key. |
| Background Scoring | As soon as you answer, the next question appears while prior answer scores in the background. |
| Duplicate Avoidance | New question requests include an exclude list to reduce repeated prompts (multi-attempt fallback). |
| Interviewee Experience | Clean single‑panel flow with timers, speech‑to‑text mic (Web Speech API), progress bar. Final score & summary are hidden from interviewee. |
| Interviewer Dashboard | Separate tab lists candidates, per-question answers, scores, feedback, final summary & aggregate score. |
| Persistence | Session-based (sessionStorage) via redux-persist—state resets when browser session ends. |
| Restart | "Start New Interview" button clears active interview context while retaining prior candidates in the dashboard. |
| Safety Nets | Auto finalization after last question, resilient guards preventing double-fetch & duplicate question insertion. |

---

## 🚀 Quick Start
```bash
npm install
npm run dev
```
Visit: http://localhost:5173

No OpenAI key? The app still works with fallback question templates, heuristic scoring, and a generated summary template.

---

## 🔐 Optional: Enable OpenAI
Create a `.env.local` file in the project root:
```
VITE_OPENAI_API_KEY=sk-your-key-here
```
Restart dev server.

What changes when enabled:
- Questions: Real single-question prompts per difficulty.
- Scoring: AI returns `{ "score": 0-100, "feedback": "..." }` (robust JSON extraction logic; fallback heuristic if malformed).
- Summary: Concise (≤ ~60 words) candidate summary.

⚠️ For production: Never expose raw API keys from the frontend. Add a lightweight backend proxy (Node/Express, serverless function, etc.) to forward sanitized requests.

---

## 🧠 Interview Logic Overview
Flow per candidate:
1. Resume uploaded → parse & prefill profile.
2. Collect missing fields (blocking gate).
3. Begin Q1 (easy) when profile complete.
4. For each question: start timer → user answers (or timeout) → dispatch scoring → immediately fetch next.
5. After Q6: finalize → generate summary & final score (interviewer only).

Timing enforcement: Each question stores `startedAt` + `timeLimitSec`; a ticking effect auto-submits when remaining hits 0.

Difficulty sequence helper selects by index (0–5).

---

## 🗣 Speech to Text
Implemented via the browser Web Speech API (`window.SpeechRecognition` / `webkitSpeechRecognition`).
- Continuous interim transcription with final consolidation.
- Graceful disable + tooltip if unsupported.
- No external libs required.

Browser Support Caveat: Chrome/Edge only (desktop). Firefox & Safari currently show disabled mic button.

---

## 🛡 Resilience & Guards
- `advancingRef` prevents overlapping fetches.
- Question list length watcher releases locks once a new question is appended.
- Duplicate prompt mitigation: exclude list passed to AI; up to 3 attempts then unique fallback label.
- Fallback pathways when OpenAI unreachable (network, invalid key) for all three AI functions.

---

## 📁 Project Structure
```
src/
	services/
		aiService.ts        # OpenAI + fallback logic (questions, scoring, summary)
		resumeParser.ts     # PDF/DOCX parsing & entity extraction
	store/
		slices/
			candidatesSlice.ts # Interview state, thunks, scoring, summary
			sessionSlice.ts     # Session level UI flags
		index.ts              # Persisted Redux store (sessionStorage)
	ui/
		IntervieweeView.tsx  # Candidate flow (timers, mic, adaptive Qs)
		InterviewerView.tsx  # Dashboard & details
	root/Root.tsx          # Tab layout & welcome back logic
```

---

## 🧪 Testing Suggestions (Manual)
- Upload resume with partial data → ensure missing form appears.
- Answer quickly vs let timer expire.
- Verify next question appears while previous is still “scoring in background”.
- Refresh mid-interview (same session) → state restored.
- Close tab & reopen (new session) → state cleared.
- Use mic on Chrome; verify disabled state on unsupported browsers.

---

## 🛠 Tech Stack
- React 18 + TypeScript + Vite
- Redux Toolkit + redux-persist (sessionStorage adapter)
- Ant Design
- pdfjs-dist (PDF text extraction) & mammoth (DOCX to text)
- OpenAI Chat Completions (optional) via fetch (no SDK)

---

## 🔄 Key Design Decisions
| Decision | Rationale |
|----------|-----------|
| sessionStorage persistence | Interview data should not survive a completely new browser session. |
| Client-side AI calls (dev only) | Faster iteration; instructs users to proxy for prod. |
| Exclude-based duplicate mitigation | Lightweight; avoids full semantic similarity check. |
| Background scoring | Removes perceived wait between questions; keeps candidate momentum. |
| Hidden results for interviewee | Mirrors real interview scenarios where feedback is not immediate. |

---

## 🚧 Future Improvements
- Add server proxy for secure AI calls & logging.
- Persist fine-grained remaining time on unload (improve timer accuracy after refresh mid-question).
- Richer candidate analytics: per-category scoring, difficulty weighting.
- Export / import results (CSV, JSON, PDF report).
- Pluggable rubric system per question.
- Accessibility pass (ARIA live regions for timers & mic state).
- Add unit tests for reducers & thunks.

---

Happy interviewing!
