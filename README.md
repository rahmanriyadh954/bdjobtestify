# BD JobTestify — Bangladesh Government Job Exam Portal

A full-stack React + Supabase exam preparation platform for Bangladesh government job exams (BCS, Bank, NTRCA, Primary, etc.).

---

## Features

### Student
- Daily & weekly model tests
- Government-style exam paper (full exam paper layout with Bangladesh Govt emblem)
- MCQ (single-choice) with subject ordering: বাংলা → English → Mathematics → General Knowledge & Science
- Written/descriptive questions — type answer or upload a handwritten image (or both)
- AI evaluates written answers instantly on submission (text + image)
- Anti-cheating: tab switch / multiple window detection → auto-terminate at 3 warnings
- Instant results with detailed review

### Admin
- Question bank with AI generation (topic, file/image upload)
- Model test builder — drag/drop question selection
- Exam schedule (daily / weekly)
- Results panel: view all submissions, export CSV
- Mark written answers via AI (one-click) **or** manually enter marks
- Student reports with charts

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New Query**, paste the entire contents of `supabase/schema.sql` and click **Run**.
   - If you are upgrading an existing install, also run `supabase/fix_2026_09_20.sql`.
3. To make yourself admin, run:
   ```sql
   update public.profiles set role = 'admin' where username = 'YOUR_USERNAME_HERE';
   ```

### 2. Environment variables

Copy `.env` and fill in your keys:

```
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
REACT_APP_GEMINI_MODEL=gemini-2.0-flash    # optional
```

Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Install & run

```bash
npm install
npm start
```

---

## Upgrading from a previous version

Run `supabase/fix_2026_09_20.sql` in the Supabase SQL editor. This:

1. **Preserves student results when an exam is deleted** — previously, deleting a model test would cascade-delete all student results. Now `model_test_id` is set to NULL instead.
2. **Allows admin-manual marking** — `assessed_by` column now accepts `'admin-manual'`.
3. **Adds `list_written_assessments` RPC** — powers the admin review panel for re-checking already-graded answers.

---

## Key architecture notes

### Anti-cheat (ExamPaper.jsx)
- `visibilitychange` fires when the student switches tabs or minimises the browser.
- `window.blur` fires when a second window/tab is opened or the user Alt+Tabs.
- First 2 events: warning toast. 3rd event: instant auto-submit + terminated screen.
- DevTools keyboard shortcuts, right-click, and clipboard shortcuts are blocked.

### Subject ordering on exam paper (GovtExamPaper.jsx)
Questions are always displayed in this fixed order regardless of how the admin picks them:
`বাংলা → English → Mathematics → General Knowledge (Bangladesh) → General Knowledge (International) → General Science → ICT → Mental Ability → Geography → History → Constitution → Current Affairs`

### Written answer evaluation (aiService.js)
- Students may submit a typed answer, a handwritten image, or both.
- `assessWrittenAnswer()` sends both to Gemini and grades the best combined evidence.
- Partial marks are always available for written questions only.
- MCQ scoring (positive/negative) is done server-side in the `submit_exam` SQL function.

### Admin marking (ResultsTab.jsx)
- **AI mark**: one click runs `assessWrittenAnswer` and saves the result.
- **Manual mark**: admin enters a number and optional feedback directly.
- Both modes use the same `recordWrittenAssessment` RPC, which recalculates the student's total score automatically.

### Data safety
- Correct answers are **never sent to the browser** — only available via `get_exam_paper()` RPC which strips them.
- RLS policies ensure students only see their own results.
- Profile column protection trigger prevents students from escalating to admin via browser console.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, plain CSS (no component library) |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions) |
| AI | Google Gemini (question generation + written answer evaluation) |
| Auth | Supabase Auth |
