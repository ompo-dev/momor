// Helpers for note icons (emoji OR image) and cover images.

/** An icon is an image when it's a data-URL, http(s) URL, or file path. */
export function isImageIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return (
    icon.startsWith("data:") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("file:") ||
    icon.startsWith("/")
  );
}

/** Read a picked image File into a data-URL string for storage in SQLite. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Curated emoji set for the lightweight picker (no extra dependency). */
export const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: "Frequentes",
    emojis: ["📝", "📄", "📌", "⭐", "🔥", "✅", "💡", "🎯", "🚀", "🐛", "📊", "🗂️"],
  },
  {
    label: "Objetos",
    emojis: ["📁", "📂", "📕", "📗", "📘", "📙", "📓", "📒", "🔖", "🏷️", "📎", "🖇️", "📐", "📏", "✏️", "🖊️", "🖌️", "🎨", "📷", "🎬"],
  },
  {
    label: "Símbolos",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "✨", "⚡", "🌟", "💥", "🔔", "🎵", "♻️", "✔️", "❌", "❓", "❗", "⚠️", "🔒", "🔑"],
  },
  {
    label: "Pessoas & Natureza",
    emojis: ["😀", "😎", "🤔", "🧠", "👍", "👏", "🙌", "💪", "🌱", "🌿", "🌳", "🌸", "🍀", "☀️", "🌙", "⛰️", "🌊", "🔮", "🦋", "🐢"],
  },
  {
    label: "Trabalho",
    emojis: ["💼", "📈", "📉", "💰", "🏆", "🎓", "🗓️", "⏰", "📅", "🧾", "🛠️", "⚙️", "🔧", "🧪", "🔬", "💻", "🖥️", "📱", "🌐", "🤝"],
  },
];
