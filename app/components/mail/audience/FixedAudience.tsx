"use client";

import { useState, type FC } from "react";
import Link from "next/link";
import { Copy, Lock } from "lucide-react";
import type { MailAudience } from "@/app/lib/mail/types";
import { BTN } from "../ui";
import PeopleTable, { START_VIEW, type PeopleView } from "./PeopleTable";
import { useAudiencePeople } from "./useAudiencePeople";
import { AUDIENCE_HREF, BUILT_IN_NAMES } from "./filterText";

/** A fixed audience, read only: its people a page at a time, and a way to start your own from it. */
const FixedAudience: FC<{ audience: MailAudience & { builtIn: NonNullable<MailAudience["builtIn"]> } }> = ({ audience }) => {
  const [view, setView] = useState<PeopleView>(START_VIEW);
  const filter = audience.filter ?? { kind: "users" };
  const people = useAudiencePeople({ filter, builtIn: audience.builtIn, page: view.page, pageSize: view.pageSize, q: view.q });
  const name = audience.name || BUILT_IN_NAMES[audience.builtIn];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold">
          {name}
          <Lock className="h-4 w-4 flex-none text-gray-400" aria-label="Fixed audience" />
        </h1>
        <Link href={`${AUDIENCE_HREF}/new?from=${audience.id}`} className={BTN}>
          <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicate as a new audience
        </Link>
      </header>
      <PeopleTable people={people} view={view} onView={setView} kind={filter.kind} />
    </div>
  );
};

export default FixedAudience;
