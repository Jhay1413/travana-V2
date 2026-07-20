// Central switch for the chat model used across every AI feature (enquiry
// brain, internal-chat assistant, ai-enquiry, transition/grouped-ask helpers).
// Override per-environment with OPENAI_CHAT_MODEL.
//
// IMPORTANT: this must be an OpenAI *GPT-series* chat model that supports JSON
// mode (`response_format`), function/tool calling, and `temperature` — the code
// relies on all three. Do NOT point it at an o-series reasoning model (o1/o3/
// o4-…) without code changes: those reject `temperature`, use
// `max_completion_tokens`, and handle system prompts differently.
//
// If the default below isn't enabled on your OpenAI account, set
// OPENAI_CHAT_MODEL to a model you do have access to (e.g. "gpt-4o").
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1";

// Cheaper OpenAI model for small, low-risk classification/short-utterance
// calls — the router, the grouped ask, transition replies, beneficiary asks,
// ticket confirmation, and availability-time parsing. These are short-input/
// short-output calls with hardcoded fallback strings on failure, so a cheaper
// model is an acceptable trade-off; the main conversation brain (generateTurn)
// and other higher-stakes calls stay on CHAT_MODEL.
//
// IMPORTANT: same constraints as CHAT_MODEL above — must be an OpenAI
// GPT-series chat model that supports JSON mode and `temperature`. Override
// per-environment with OPENAI_UTILITY_MODEL.
export const UTILITY_MODEL = process.env.OPENAI_UTILITY_MODEL ?? "gpt-4.1-mini";
