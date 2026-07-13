// Shared types for the internal (staff-facing) AI chatbot module.

// 'assistant'  — the org-wide AI assistant (Goal A): answers staff questions
//                using the org's bot persona + knowledge base + retrieved context.
// 'test_flow'  — a staff-driven test of the customer-facing enquiry flow.
//                Gated to org_admin/platform_admin. Not wired up yet (Phase 2+).
export type ChatMode = "assistant" | "test_flow";

export type ChatMessageRole = "user" | "assistant" | "system_note";
