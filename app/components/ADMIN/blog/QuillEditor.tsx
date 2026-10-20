"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, RefObject } from "react";
import type ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { registerTableStyle } from "./tableStyle";
import { registerSoftBreak } from "./softBreak";

type QuillProps = ComponentProps<typeof ReactQuill>;

const QuillWithRef = dynamic(
  async () => {
    const { default: RQ, Quill } = await import("react-quill-new");
    registerTableStyle(Quill);
    registerSoftBreak(Quill);
    const Wrapped = ({ forwardedRef, ...props }: QuillProps & { forwardedRef: RefObject<ReactQuill | null> }) => <RQ ref={forwardedRef} {...props} />;
    return Wrapped;
  },
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-md bg-gray-100" /> },
);

export type QuillRef = RefObject<ReactQuill | null>;

const QuillEditor = (props: QuillProps & { forwardedRef: QuillRef }) => <QuillWithRef {...props} />;

export default QuillEditor;
