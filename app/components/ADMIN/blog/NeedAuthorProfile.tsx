import type { FC } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";

const NeedAuthorProfile: FC<{ action?: "write" | "edit" }> = ({ action = "write" }) => (
  <div data-need-profile className="mx-auto mt-16 max-w-[560px] rounded-md border-2 border-[#222325] bg-white p-8 text-center shadow-[6px_6px_0_0_#e1f073]">
    <h1 className="text-2xl font-extrabold text-primary">Create your author profile first</h1>
    <p className="mt-3 text-sm leading-relaxed text-primary/70">
      Posts are published under an author profile linked to your account. Set yours up and you can {action === "edit" ? "edit this post" : "start writing"} right away.
    </p>
    <Link
      href="/heroshima/profile"
      className="drop-shadow-primary2-hover mt-6 inline-flex h-12 items-center gap-2 rounded-sm border-2 border-primary bg-primary px-5 text-sm font-bold text-white transition-all">
      <UserPlus className="h-4 w-4" />
      Create my author profile
    </Link>
  </div>
);

export default NeedAuthorProfile;
