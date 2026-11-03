import { like } from "drizzle-orm";
import { db } from "../server/config/database";
import {
  training_course,
  training_section,
  training_lesson,
  training_lesson_asset,
  training_quiz,
  training_question,
  training_choice,
} from "../shared/schema";

// Realistic demo/test data for the Training (LMS) feature — modelled on a
// travel-agency's internal onboarding & product training.
//   npm run db:seed-training      (requires migration 0019 applied)
//
// All seeded courses are titled with a "[SEED] " prefix so this script is
// idempotent: it deletes prior seed rows first (FK cascade removes their
// lessons/assets), then re-inserts. Courses are GLOBAL (org_id = NULL) +
// PUBLISHED (except one draft) so they appear in every tenant's learner
// Training list with no extra setup.
//
// Videos use public, embedding-friendly sample MP4s that play in a native
// <video> element; thumbnails/slides use deterministic picsum images. Swap
// these for real uploaded assets in production.
//
// Rich text: training descriptions/captions are edited with the TipTap
// RichTextEditor and stored as HTML. The "[SEED] Rich Text Showcase" course
// carries HTML in all four rich fields (course, section, lesson description,
// slide caption) to exercise the editor/RichTextDisplay round-trip. The other
// courses deliberately keep plain text to represent legacy rows that predate
// the editor and must still render.

// Verified-live, embedding-friendly, HTTP Range-supported MP4s (checked 2026-07).
// Native <video> playback needs no CORS. Swap for real uploads in production.
const V = {
  bunny: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", // full ~9:56
  blazes: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
  escapes: "https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4",
  elephants: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
  fun: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_2MB.mp4",
};
const thumb = (seed: string) => `https://picsum.photos/seed/${seed}/640/360`;
const slide = (seed: string) => `https://picsum.photos/seed/${seed}/1280/720`;

type LessonSeed = {
  title: string;
  description: string;
  type: "video" | "graphics";
  is_required?: boolean;
  video_url?: string;
  video_duration_sec?: number;
  assets?: { asset_url: string; caption: string }[];
};

type QuestionSeed = {
  text: string;
  type: "single" | "multiple";
  points?: number;
  choices: { text: string; correct: boolean }[];
};

type QuizSeed = {
  title?: string;
  questions: QuestionSeed[];
};

// Optional per-course section. Seeds without `sections` get one implicit
// "Section 1" (no description) holding all lessons, as before.
type SectionSeed = {
  title: string;
  description?: string; // HTML (rich text) or plain text
  lessons: LessonSeed[];
};

type CourseSeed = {
  title: string;
  description: string;
  thumbnail_url: string;
  status: "draft" | "published";
  passing_score: number;
  lessons?: LessonSeed[]; // shorthand for a single default section
  sections?: SectionSeed[]; // takes precedence over `lessons`
  quiz?: QuizSeed;
};

// Normalise either shape to a list of sections.
const sectionsOf = (c: CourseSeed): SectionSeed[] =>
  c.sections ?? [{ title: "Section 1", lessons: c.lessons ?? [] }];

const COURSES: CourseSeed[] = [
  {
    title: "[SEED] New Agent Onboarding: Your First Week",
    description:
      "Everything a new travel consultant needs to hit the ground running — a tour of the CRM, how leads flow from enquiry to booking, and the day-to-day habits of a top performer.",
    thumbnail_url: thumb("travana-onboarding"),
    status: "published",
    passing_score: 80,
    lessons: [
      {
        title: "Welcome to the Agency",
        description: "Meet the team, our values, and what great customer service looks like here.",
        type: "video",
        video_url: V.bunny,
        video_duration_sec: 596,
      },
      {
        title: "CRM Tour: Enquiries, Quotes & Bookings",
        description: "A guided walkthrough of the pipeline board and where each deal stage lives.",
        type: "video",
        video_url: V.blazes,
        video_duration_sec: 10,
      },
      {
        title: "The Sales Pipeline at a Glance",
        description: "Reference slides covering each stage of the customer journey.",
        type: "graphics",
        assets: [
          { asset_url: slide("pipeline-enquiry"), caption: "Stage 1 — Enquiry: capture the lead & qualify the trip" },
          { asset_url: slide("pipeline-quote"), caption: "Stage 2 — Quote: build and send options" },
          { asset_url: slide("pipeline-booking"), caption: "Stage 3 — Booking: confirm, collect payment, issue docs" },
          { asset_url: slide("pipeline-aftercare"), caption: "Stage 4 — Aftercare: follow up & win referrals" },
        ],
      },
    ],
    quiz: {
      title: "Onboarding Knowledge Check",
      questions: [
        {
          text: "What is the correct order of the sales pipeline stages?",
          type: "single",
          choices: [
            { text: "Enquiry → Quote → Booking → Aftercare", correct: true },
            { text: "Quote → Enquiry → Booking → Aftercare", correct: false },
            { text: "Booking → Quote → Enquiry → Aftercare", correct: false },
            { text: "Enquiry → Booking → Quote → Aftercare", correct: false },
          ],
        },
        {
          text: "Which of these happen during the Booking stage? (Select all that apply)",
          type: "multiple",
          choices: [
            { text: "Confirm the trip", correct: true },
            { text: "Collect payment", correct: true },
            { text: "Issue travel documents", correct: true },
            { text: "Capture the initial lead", correct: false },
          ],
        },
        {
          text: "Where do you track a deal's current stage?",
          type: "single",
          choices: [
            { text: "The pipeline board", correct: true },
            { text: "A personal spreadsheet", correct: false },
            { text: "The company newsletter", correct: false },
          ],
        },
      ],
    },
  },
  {
    title: "[SEED] Turning Enquiries into Booked Holidays",
    description:
      "Master the sales conversation: how to qualify an enquiry, build a compelling quote, handle price pushback, and close with confidence.",
    thumbnail_url: thumb("travana-selling"),
    status: "published",
    passing_score: 75,
    lessons: [
      {
        title: "Qualifying an Enquiry",
        description: "The questions that uncover budget, dates, party size, and must-haves.",
        type: "video",
        video_url: V.elephants,
        video_duration_sec: 10,
      },
      {
        title: "Anatomy of a Great Quote",
        description: "What separates a quote that converts from one that gets ignored.",
        type: "graphics",
        assets: [
          { asset_url: slide("quote-clarity"), caption: "Lead with the experience, not just the price" },
          { asset_url: slide("quote-options"), caption: "Offer 2–3 options — good / better / best" },
          { asset_url: slide("quote-urgency"), caption: "Set an expiry and a clear next step" },
        ],
      },
    ],
    quiz: {
      title: "Selling Skills Check",
      questions: [
        {
          text: "What should a great quote lead with?",
          type: "single",
          choices: [
            { text: "The experience and value, not just the price", correct: true },
            { text: "The cheapest possible option only", correct: false },
            { text: "A long list of terms and conditions", correct: false },
          ],
        },
        {
          text: "Which details should you uncover when qualifying an enquiry? (Select all that apply)",
          type: "multiple",
          choices: [
            { text: "Budget", correct: true },
            { text: "Travel dates", correct: true },
            { text: "Party size", correct: true },
            { text: "The customer's favourite colour", correct: false },
          ],
        },
        {
          text: "A good quote sets a clear next step and an expiry.",
          type: "single",
          choices: [
            { text: "True", correct: true },
            { text: "False", correct: false },
          ],
        },
      ],
    },
  },
  {
    title: "[SEED] Cruise Product Knowledge Essentials",
    description:
      "The fundamentals every consultant should know before selling a cruise — lines and their audiences, cabin grades, dining, and how commission is earned.",
    thumbnail_url: thumb("travana-cruise"),
    status: "published",
    passing_score: 70,
    lessons: [
      {
        title: "Cruise Lines, Cabins & Commission",
        description: "Match the right line to the right customer and understand the margin.",
        type: "video",
        video_url: V.escapes,
        video_duration_sec: 10,
      },
      {
        title: "Cabin Grades Cheat Sheet",
        description: "Inside, outside, balcony and suite — who they suit and how they upsell.",
        type: "graphics",
        assets: [
          { asset_url: slide("cabin-inside"), caption: "Inside — best value, great for first-timers on a budget" },
          { asset_url: slide("cabin-balcony"), caption: "Balcony — the popular upsell; sells the view" },
          { asset_url: slide("cabin-suite"), caption: "Suite — premium perks, priority everything" },
        ],
      },
    ],
    quiz: {
      title: "Cruise Essentials Check",
      questions: [
        {
          text: "Which cabin grade is the most popular upsell because it 'sells the view'?",
          type: "single",
          choices: [
            { text: "Balcony", correct: true },
            { text: "Inside", correct: false },
            { text: "Outside", correct: false },
          ],
        },
        {
          text: "Which cabin grade is typically best value for a budget first-timer?",
          type: "single",
          choices: [
            { text: "Inside", correct: true },
            { text: "Suite", correct: false },
            { text: "Balcony", correct: false },
          ],
        },
      ],
    },
  },
  {
    // HTML mirrors what TipTap (StarterKit + Link) emits. Captions stay well
    // under the 2000-char cap enforced by training-lesson.validator.ts.
    title: "[SEED] Rich Text Showcase",
    description:
      '<p>A tour of the <strong>Hub training</strong> rich-text fields. This course description is stored as <em>HTML</em>.</p><ul><li>Course description</li><li>Section description</li><li>Lesson description</li><li>Slide captions</li></ul>',
    thumbnail_url: thumb("travana-richtext"),
    status: "published",
    passing_score: 70,
    sections: [
      {
        title: "Handling a Holiday Enquiry",
        description:
          '<h3>What you will learn</h3><p>How to take a <strong>first enquiry</strong> from hello to a confirmed brief.</p><blockquote><p>The best agents ask more questions than they answer in the first call.</p></blockquote><p>Allow about <code>15 minutes</code> for this section.</p>',
        lessons: [
          {
            title: "First Call Checklist",
            description:
              '<p>Use this checklist on <strong>every</strong> new enquiry:</p><ol><li>Greet the customer and confirm their name</li><li>Ask about <em>dates, budget and party size</em></li><li>Note any must-haves, such as accessibility needs</li></ol><p>Full guidance lives in the <a href="https://example.com/agent-handbook">agent handbook</a>.</p>',
            type: "graphics",
            assets: [
              {
                asset_url: slide("rich-bold"),
                caption: "<p><strong>Listen first, sell second</strong></p>",
              },
              {
                asset_url: slide("rich-bullets"),
                caption:
                  "<p><strong>Always capture:</strong></p><ul><li>Travel dates and flexibility</li><li>Budget per person</li><li>Who is travelling, including children</li><li>Departure airport</li></ul>",
              },
              {
                asset_url: slide("rich-numbered"),
                caption:
                  "<p>Follow the quote workflow in order:</p><ol><li>Confirm the brief with the customer</li><li>Price two or three options</li><li>Send the quote with an expiry date</li><li>Follow up within 48 hours</li></ol>",
              },
              {
                asset_url: slide("rich-link"),
                caption:
                  '<p>Check the latest entry rules on the <a href="https://www.gov.uk/foreign-travel-advice">FCDO travel advice</a> page before you confirm any booking.</p>',
              },
              {
                asset_url: slide("rich-paragraphs"),
                caption:
                  "<p>A great quote tells a story. Open with the <em>experience</em>: the sunset from the balcony, the private transfer waiting at arrivals.</p><p>Only then introduce the price, framed as the cost of that experience rather than a line item.</p><p>Close with one clear next step so the customer always knows what to do.</p>",
              },
              {
                asset_url: slide("rich-plain"),
                caption: "Legacy plain-text caption: no HTML, should still render normally.",
              },
            ],
          },
          {
            title: "Following Up on a Quote",
            description:
              "<p>Timing matters. Follow up <strong>within 48 hours</strong>, and always offer something new:</p><ul><li>A fresh photo or review of the resort</li><li>A reminder that the price is <em>held until the expiry date</em></li></ul>",
            type: "video",
            video_url: V.blazes,
            video_duration_sec: 10,
          },
        ],
      },
    ],
  },
  {
    title: "[SEED] Advanced Objection Handling & Closing (draft)",
    description:
      "Work-in-progress course — visible only in the admin authoring list, not to learners. Used to demonstrate the draft state.",
    thumbnail_url: thumb("travana-closing"),
    status: "draft",
    passing_score: 80,
    lessons: [
      {
        title: '"It\'s too expensive" — reframing price',
        description: "Turn a price objection into a value conversation.",
        type: "video",
        video_url: V.fun,
        video_duration_sec: 10,
      },
    ],
  },
];

async function main() {
  console.log("Seeding training data...");

  // Idempotency: clear previous seed data (cascade removes lessons + assets)
  await db.delete(training_course).where(like(training_course.title, "[SEED]%"));

  for (const c of COURSES) {
    const [course] = await db
      .insert(training_course)
      .values({
        visibility: "global",
        title: c.title,
        description: c.description,
        thumbnail_url: c.thumbnail_url,
        status: c.status,
        passing_score: c.passing_score,
        require_content_before_quiz: true,
      })
      .returning({ id: training_course.id });

    // Sections hold the lessons; lesson position is course-wide.
    let position = 0;
    let sectionPos = 0;
    for (const s of sectionsOf(c)) {
    const [section] = await db
      .insert(training_section)
      .values({
        course_id: course.id,
        title: s.title,
        description: s.description ?? null,
        position: sectionPos++,
      })
      .returning({ id: training_section.id });

    for (const l of s.lessons) {
      const [lesson] = await db
        .insert(training_lesson)
        .values({
          course_id: course.id,
          section_id: section.id,
          title: l.title,
          description: l.description,
          type: l.type,
          position: position++,
          is_required: l.is_required ?? true,
          video_url: l.video_url ?? null,
          video_duration_sec: l.video_duration_sec ?? null,
        })
        .returning({ id: training_lesson.id });

      if (l.assets?.length) {
        await db.insert(training_lesson_asset).values(
          l.assets.map((a, i) => ({
            lesson_id: lesson.id,
            asset_url: a.asset_url,
            caption: a.caption,
            position: i,
          })),
        );
      }
    }
    }

    if (c.quiz) {
      const [quiz] = await db
        .insert(training_quiz)
        .values({
          course_id: course.id,
          title: c.quiz.title ?? null,
          shuffle_questions: false,
        })
        .returning({ id: training_quiz.id });

      let qPos = 0;
      for (const q of c.quiz.questions) {
        const [question] = await db
          .insert(training_question)
          .values({
            quiz_id: quiz.id,
            text: q.text,
            type: q.type,
            points: q.points ?? 1,
            position: qPos++,
          })
          .returning({ id: training_question.id });

        await db.insert(training_choice).values(
          q.choices.map((choice, i) => ({
            question_id: question.id,
            text: choice.text,
            is_correct: choice.correct,
            position: i,
          })),
        );
      }
    }

    const quizNote = c.quiz ? `, quiz (${c.quiz.questions.length} q)` : "";
    console.log(`  ${c.status.padEnd(9)} "${c.title}" — ${sectionsOf(c).reduce((n, s) => n + s.lessons.length, 0)} lesson(s)${quizNote}`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
