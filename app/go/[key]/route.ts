import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendOrNull } from "@/app/lib/backend";
import { loginWithNext, requiresSession } from "@/app/lib/next-url";

export const dynamic = "force-dynamic";

function safeDestination(href: string, origin: string): URL | null {
  try {
    const url = new URL(href, origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: Request, props: { params: Promise<{ key: string }> }) {
  const { key } = await props.params;
  const requestUrl = new URL(request.url);
  const post = requestUrl.searchParams.get("p")?.slice(0, 200) ?? "";
  const placement = requestUrl.searchParams.get("s")?.slice(0, 40) ?? "";

  const cta = await backendOrNull<{ href: string }>(`/blog/ctas/${encodeURIComponent(key)}/click`, { method: "POST" }).catch((error) => {
    console.error("cta click failed", error);
    return null;
  });

  const fallback = new URL("/blogs", requestUrl.origin);
  const destination = cta ? (safeDestination(cta.href, requestUrl.origin) ?? fallback) : fallback;
  if (cta) {
    destination.searchParams.set("utm_source", "blog");
    destination.searchParams.set("utm_medium", placement || "cta");
    destination.searchParams.set("utm_campaign", key);
    if (post) destination.searchParams.set("utm_content", post);
  }

  if (destination.origin === requestUrl.origin && requiresSession(destination.pathname)) {
    const session = await auth().catch(() => null);
    if (!session?.user) {
      return NextResponse.redirect(new URL(loginWithNext(destination.pathname + destination.search), requestUrl.origin), 302);
    }
  }

  return NextResponse.redirect(destination, 302);
}
