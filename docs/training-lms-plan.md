# Training / LMS Feature — Implementation Plan

> Udemy-style training inside the Hub: upload videos or graphics, end each course with a
> multiple-choice quiz, enforce a passing score, and track progress, attempts, and completion.
>
> Status: **Planning** · Target backend: `server/v2/modules/training/` · Target frontend: `client/src/features/hub/`

---

## 1. Product Scope

- **Authors** (`platform_admin` only, v1) create **Courses**.
- A course contains ordered **Lessons**, each holding either a **video** or a **set of graphics/slides**, plus optional rich-text notes.
- A course ends with a **Quiz**: multiple-choice questions with a configurable **passing score** (%).
- **Staff** enroll, consume content, take the quiz, and receive **Pass/Fail** + a **completion record** (certificate).
- Tracks **per-lesson progress**, **quiz attempts**, and **pass-rate analytics**.

---

## 2. Locked Decisions

| Area | Decision | Implication |
|---|---|---|
| **Video upload** | Presigned direct-to-S3 | Browser uploads video straight to S3; server stores only the key. Add `getPresignedPutUrl` / `getPresignedGetUrl` to S3 utils. Graphics keep the existing multer → `uploadImageToS3` path. |
| **Authoring roles** | `platform_admin` only | All authoring/analytics routes gate on `requireOrgRole(["platform_admin"])`. Other roles are learners only in v1. |
| **Course scope** | Global **+** per-company | `training_course.org_id` is nullable: `NULL` = global (all tenants), set = one org. Add `visibility` enum for explicit intent. |
| **Retake policy** | Unlimited | No `maxAttempts` / cooldown in v1. `attempt_number` still tracked for analytics. |

---

## 3. Business Logic / Rules

### Roles & permissions
| Action | Who |
|---|---|
| Create/edit/publish course, lessons, quiz | `platform_admin` |
| Enroll & take training | all staff roles (`STAFF_ROLES` already gate `/hub`) |
| View analytics (pass rate, completion) | `platform_admin` |

### Course lifecycle
`draft → published → archived`. Only **published** courses are enrollable/visible to learners.
A learner's quiz attempt **snapshots** its question set, so later edits don't corrupt historical results.

### Visibility (global + per-company)
- `org_id IS NULL` → global course, visible to every tenant.
- `org_id = X` → visible only to org X.
- Learner query: `WHERE status = 'published' AND (org_id IS NULL OR org_id = :myOrgId)`.
- `platform_admin` sees all.
- The "NULL = global" rule lives in a single helper (`buildTrainingScopeConds`), mirroring `scope-conditions.ts`.

### Progress & completion
- A lesson is **complete** when the learner reaches its end (video: watched ≥ configurable %, default 90%; graphics: viewed last slide).
- Content is **100% complete** when all required lessons are complete.
- Quiz **unlocks** after content completion (configurable via `require_content_before_quiz`).
- **Quiz score** = `correctAnswers / totalQuestions * 100`. **Pass** if `score ≥ course.passing_score`.
- **Course completion** = content complete **AND** quiz passed → issue completion/certificate record with timestamp + score.

### Quiz / attempt rules
- **Unlimited retakes**; `attempt_number` increments for analytics ("avg attempts to pass").
- Each attempt snapshots questions + correct answers at submit time.
- **Correct answers are never sent to the client** during an attempt — grading is **server-side only**.
- Supports single-answer (radio) and multi-answer (checkbox); multi-answer is correct only if the selected set exactly matches.
- Optional (later): shuffle question/choice order, per-question weighting. v1 = 1 point each.

---

## 4. Data Model (`shared/schema.ts`)

Follows existing conventions: UUID PKs via `gen_random_uuid()`, `org_id` FK for tenancy, `defaultNow()` timestamps, `pgEnum` for statuses. Add `createInsertSchema` + `$inferSelect` type exports per table. Migrate with `drizzle-kit generate` → `migrate`.

### Enums
```
course_status_enum      : draft | published | archived
course_visibility_enum  : global | org
lesson_type_enum        : video | graphics
question_type_enum      : single | multiple
enrollment_status_enum  : in_progress | completed
```

### Tables
```
training_course
  id, org_id (FK organization, nullable = global), branch_id (nullable),
  visibility course_visibility_enum,
  title, description, thumbnail_url,
  status course_status_enum default 'draft',
  passing_score int default 80,
  require_content_before_quiz bool default true,
  created_by (user), created_at, updated_at

training_lesson                     -- ordered content within a course
  id, course_id (FK, cascade), title, description (rich text),
  type lesson_type_enum, position int, is_required bool default true,
  video_url text null, video_duration_sec int null,
  created_at, updated_at

training_lesson_asset               -- graphics/slides for a graphics lesson (1..n)
  id, lesson_id (FK, cascade), asset_url, caption, position

training_quiz                       -- one per course (1:1)
  id, course_id (FK, cascade, unique), title,
  shuffle_questions bool default false, created_at, updated_at

training_question
  id, quiz_id (FK, cascade), text, type question_type_enum,
  position int, points int default 1

training_choice
  id, question_id (FK, cascade), text, is_correct bool, position

-- learner state --
training_enrollment
  id, course_id (FK), user_id, org_id,
  status enrollment_status_enum default 'in_progress',
  enrolled_at, completed_at null, unique(course_id, user_id)

training_lesson_progress
  id, enrollment_id (FK, cascade), lesson_id,
  completed bool, progress_pct int, last_viewed_at,
  unique(enrollment_id, lesson_id)

training_quiz_attempt
  id, enrollment_id (FK), quiz_id, user_id,
  attempt_number int, score_pct int, passed bool,
  answers_snapshot jsonb,           -- questions + chosen + correct at submit time
  started_at, submitted_at

training_certificate                -- optional
  id, enrollment_id (unique), user_id, course_id, org_id,
  score_pct, issued_at, certificate_no
```

---

## 5. Media Upload Architecture

The current path (multer `memoryStorage` + 5 MB cap + buffer → `uploadImageToS3`) is fine for graphics but **wrong for video** (large files blow memory + the cap). Two lanes:

- **Graphics / thumbnails / slides (small):** reuse existing multer → S3 (`uploadImageToS3(file, "training-assets")`). No new infra.
- **Video (large): presigned direct-to-S3.**
  1. `POST /training/uploads/presign` returns a presigned `PUT` URL (`@aws-sdk/s3-request-presigner`, prefix `training-videos/`).
  2. Browser `PUT`s the file directly to S3.
  3. Client sends the returned key to the lesson API.
  4. Playback via presigned GET through the existing `/api/v2/files` proxy (or signed CloudFront later for CDN + range seeking).
- **Future (out of scope v1):** MediaConvert transcoding for adaptive bitrate.

New S3 util additions: `getPresignedPutUrl(key, contentType)`, `getPresignedGetUrl(key)`.

---

## 6. Backend Structure (`server/v2/modules/training/`)

Mirrors the `booking` module exactly (asyncHandler, `successResponse`, `getScope(req)`, `AppError`, `validate()`, Drizzle-only repos).

```
server/v2/modules/training/
  training.routes.ts        # routes; multer for small assets; presign endpoint
  training.controller.ts    # asyncHandler + successResponse + getScope(req)
  training.service.ts       # business rules: publish, enroll, complete, grade
  training.repository.ts    # Drizzle queries, org/visibility-scoped
  training.validator.ts     # Zod schemas per endpoint
  training.types.ts
```

Register in `server/v2/routes/index.ts`:
```ts
router.use('/training', ...auth, trainingRoutes); // auth = isAuthenticated + orgBranchScope
```
Authoring/analytics routes additionally use `requireOrgRole(["platform_admin"])`.

### Endpoints
```
# Authoring (platform_admin)
POST   /training/courses
PATCH  /training/courses/:id
POST   /training/courses/:id/publish
POST   /training/courses/:id/lessons
PATCH  /training/lessons/:id
POST   /training/lessons/:id/assets/upload      (multer, graphics)
POST   /training/uploads/presign                (video presign)
PUT    /training/courses/:id/quiz               (upsert questions + choices)
GET    /training/courses/:id/analytics          (enrollments, avg score, pass rate)

# Learner (all staff)
GET    /training/courses                         (published, visibility-scoped, w/ my progress)
GET    /training/courses/:id                     (content; quiz WITHOUT correct answers)
POST   /training/courses/:id/enroll
PATCH  /training/lessons/:id/progress            (progress_pct / complete)
POST   /training/courses/:id/quiz/attempts       (submit answers → graded server-side)
GET    /training/courses/:id/my-status
```

**Grading is service-side only.** `GET course` strips `is_correct` from choices; the attempt endpoint loads correct answers in the repository, grades, writes `training_quiz_attempt`, and on pass + content-complete flips enrollment to `completed` (+ certificate).

---

## 7. Frontend Structure (`client/src/features/hub/`)

The hub already has `hub-training.tsx` (video **placeholder** + mock data in `client/src/data/hub-mock.ts`). Replace mock with real API. Follow the existing `features/<feature>/api` + TanStack Query pattern (shared `axios-client`, `/api/v2` base).

```
features/hub/
  api/training.api.ts                 # axios calls (FormData for assets; presign + PUT for video)
  components/
    hub-training.tsx                  # learner course list (exists → wire to API)
    training-course-view.tsx          # player + lesson nav + progress
    training-video-player.tsx         # react-player (new dependency)
    training-graphics-viewer.tsx      # slide/carousel viewer (reuse shadcn carousel + image-lightbox)
    training-quiz.tsx                 # MCQ runner, submit, result screen
    admin/
      training-course-editor.tsx      # create/edit course + lessons
      training-quiz-builder.tsx       # questions/choices, mark correct, set pass %
      training-analytics.tsx          # pass rate / completion (Recharts already present)
  hooks/                              # useTrainingCourses, useEnroll, useSubmitQuiz, useUploadVideo...
```

- **Video player:** add `react-player` (needs `onProgress` for the watched-% completion rule).
- **Graphics viewer:** reuse existing shadcn `carousel` + `image-lightbox.tsx`.
- **Quiz UI:** radio (single) / checkbox (multiple); result screen shows score, pass/fail, retake.
- **Progress:** debounced `PATCH .../progress` from the player's `onProgress`.
- **Routing:** extend the hub's internal `<Switch>` in `pages/hub/index.tsx` with `/hub/training/:courseId` and `/hub/training/admin`.

---

## 8. Phasing

1. **Foundation** — schema + migration; training module skeleton (all layers); course CRUD + publish; visibility scoping. Learner list wired to real API (no player yet).
2. **Content & upload** — presigned video upload + graphics upload; lesson authoring; video player + graphics viewer; lesson progress tracking.
3. **Quiz** — quiz builder (admin); quiz runner (learner); server-side grading; attempts, passing score; completion + certificate.
4. **Analytics & polish** — pass-rate/completion dashboard (sliceable per tenant for global courses); certificates UI; completion notifications; optional shuffle/weighting, CDN playback, transcoding.

---

## 9. Notes / Future

- Global-course analytics slice pass rate **per tenant** via `training_enrollment.org_id`.
- Multi-tenant exception (NULL = global) is isolated in `buildTrainingScopeConds` — keep it in one place.
- Consider question weighting, timed quizzes, and section-level quizzes in a later iteration.
