"use client";

import { useEffect, useState, type FC } from "react";
import { listLinkableUsers, type LinkableUser } from "@/libs/blog-admin";

const LinkedAccountSelect: FC<{ value: string; onChange: (userId: string) => void }> = ({ value, onChange }) => {
  const [users, setUsers] = useState<LinkableUser[] | null>(null);

  useEffect(() => {
    let live = true;
    listLinkableUsers()
      .then((rows) => live && setUsers(rows))
      .catch(() => live && setUsers([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-primary">Linked account</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm" disabled={users === null}>
        <option value="">{users === null ? "Loading accounts…" : "Not linked"}</option>
        {(users ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.name ? `${u.name} — ${u.email ?? ""}` : (u.email ?? u.id)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">When this account publishes a post, this author is listed first.</p>
    </div>
  );
};

export default LinkedAccountSelect;
