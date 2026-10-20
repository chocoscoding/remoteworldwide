import { LINE_HEIGHT_TOOL } from "@/app/components/ADMIN/blog/lineHeight";
export const quillToolbarOptions = [
  [{ header: [2, 3, 4, false] }], // H1 is the post title; the body starts at H2.
  ["bold", "italic", "underline", "strike"],
  ["blockquote", "code-block"],
  [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
  [{ indent: "-1" }, { indent: "+1" }],
  ["link", "image", "video", "table"],
  [{ align: [false, "center", "right"] }], // No justify: posts render left-aligned.
  [LINE_HEIGHT_TOOL], // Line spacing: Single, 1.15 (default), 1.5, Double.
  ["clean"],
];
