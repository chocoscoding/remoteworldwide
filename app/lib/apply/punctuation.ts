/** Conservative sentence-ending cleanup for prose, never headings, skills or contact details. */
export function sentenceEnding(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed || trimmed.trim().split(/\s+/).length < 3 || /(?:https?:\/\/|www\.)\S+$/i.test(trimmed)) return text;
  const end = trimmed.match(/([.!?…。！？:：])(["'”’)]*)$/u);
  if (end) return text;
  const closing = trimmed.match(/(["”’]+)$/u)?.[0] ?? "";
  const body = closing ? trimmed.slice(0, -closing.length) : trimmed;
  return body.replace(/[,;，；]+$/, "") + "." + closing;
}

type Prose = { summary: string; experience: Array<{ bullets: string[] }> };
export function punctuationLines(content: Prose): string[] {
  return [content.summary, ...content.experience.flatMap(role => role.bullets)]
    .filter(line => sentenceEnding(line) !== line);
}
