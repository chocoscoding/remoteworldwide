"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import type { FC } from "react";
import ErrorScreen from "./ErrorScreen";

const NotFound: FC<{ title: string; link?: string; buttonType: "link" | "back" }> = ({ title, link, buttonType }) => (
  <ErrorScreen
    digits={["4", "4"]}
    title={`${title} not found`}
    action={
      buttonType === "link" && link ? (
        <Link
          href={link}
          className="inline-flex h-12 items-center gap-2 rounded-sm border-2 border-primary bg-primary px-5 text-sm font-bold text-white transition-all drop-shadow-primary2-hover">
          <PlusCircle className="h-4 w-4" />
          Create new {title}
        </Link>
      ) : undefined
    }
  />
);

export default NotFound;
