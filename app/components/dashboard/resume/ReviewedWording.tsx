import { addedFigures } from "@/app/lib/dashboard/resume/ai-figures";

/** Keep the original words in context. Only newly proposed figures receive emphasis. */
export default function ReviewedWording({before, after}: {before: string; after: string}) {
  const additions = new Set(addedFigures(before, after));
  const parts = after.split(/([$€£₦]?\d+(?:[,.]\d+)*(?:%|[xkmb])?\+?)/gi);
  return <>{parts.map((part,index) => additions.has(part)
    ? <strong key={index} className="font-bold text-green-700">{part}</strong> : part)}</>;
}
