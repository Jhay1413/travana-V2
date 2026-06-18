/**
 * Constants for Quote Page
 * Reusable constants for configuration and formatting.
 */

export const EMOJI_CATEGORIES = [
  {
    label: "Smileys",
    emojis: [
      "😀",
      "😂",
      "🥹",
      "😊",
      "😍",
      "🤩",
      "😎",
      "🤔",
      "😢",
      "😤",
      "🥳",
      "😴",
      "🤗",
      "😇",
      "🙃",
      "😏",
      "🤭",
      "😬",
      "🫡",
      "👋",
    ],
  },
  {
    label: "Travel",
    emojis: [
      "✈️",
      "🏖️",
      "🏝️",
      "🌍",
      "🗺️",
      "🧳",
      "🚗",
      "🚢",
      "🏨",
      "🌅",
      "🌴",
      "⛱️",
      "🎡",
      "🗼",
      "🏔️",
      "🌊",
      "☀️",
      "🌙",
      "⭐",
      "🎒",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍",
      "👎",
      "👏",
      "🙌",
      "🤝",
      "✌️",
      "🤞",
      "💪",
      "👊",
      "✋",
      "🫶",
      "❤️",
      "🔥",
      "💯",
      "⚡",
      "🎉",
      "🎊",
      "✅",
      "❌",
      "⭕",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "📞",
      "📧",
      "💼",
      "📋",
      "📝",
      "📌",
      "📎",
      "🔗",
      "💰",
      "💳",
      "🎫",
      "🛎️",
      "🔑",
      "📅",
      "⏰",
      "🎁",
      "📱",
      "💻",
      "🖨️",
      "📊",
    ],
  },
];

export const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export const TASK_PRESETS_BY_ENTITY: Record<string, string[]> = {
  general: ["Follow up", "Phone call", "Send email", "Research", "Admin"],
  enquiry: ["New Enquiry", "Start Quote"],
  quote: [
    "Quote Call",
    "Start Quote",
    "Call Supplier",
    "Quote In Progress",
    "Re-Quote",
    "Quote Follow-Up",
    "Book or Ditch!!!",
  ],
  booking: [
    "Booking confirmation call",
    "Send booking confirmation",
    "Request passport details",
    "Online Visa",
    "Final payment",
    "Send travel documents",
    "Online check-in",
    "Holiday change",
    "Amend booking",
    "Cancellation",
  ],
};

export const TASK_CATEGORIES = [
  { value: "general", label: "General Task" },
  { value: "enquiry", label: "Enquiry" },
  { value: "quote", label: "Quote" },
  { value: "booking", label: "Booking" },
];

/**
 * Format task due date for display
 * Shows relative time for recent tasks, absolute date for distant ones
 */
export function formatTaskDue(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 0) return "Overdue";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
