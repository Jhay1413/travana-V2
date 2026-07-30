// Emoji palette shared by the composers that offer a picker (the live-chat rich
// input and the conversations inbox). Kept here rather than in either feature so
// neither has to import the other's internals, and so the two pickers can't
// drift to different sets.

export interface EmojiCategory {
  name: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐"],
  },
  {
    name: "Gestures",
    emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏"],
  },
  {
    name: "Hearts",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"],
  },
  {
    name: "Objects",
    emojis: ["🎉","🎊","🎈","🎁","🏆","🎯","📌","📎","✏️","📝","📁","📂","📅","📆","🔔","💡","🔑","🔒","📧","✈️","🏖️","🌍","⭐","🔥","💯","✅","❌","⚠️","💬","💭"],
  },
];
