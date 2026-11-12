"use client";

import { useState, type FC } from "react";
import { INPUT } from "./ui";
import { listFromText } from "./format";

/** A comma separated list typed as text: keeps what is typed, hands back the parsed list. */
const ListInput: FC<{ value: string[] | undefined; onChange: (list: string[]) => void; placeholder?: string; label?: string; className?: string }> = ({
  value,
  onChange,
  placeholder,
  label,
  className,
}) => {
  const [text, setText] = useState((value ?? []).join(", "));
  return (
    <input
      aria-label={label}
      className={className ?? INPUT}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(listFromText(e.target.value));
      }}
    />
  );
};

export default ListInput;
