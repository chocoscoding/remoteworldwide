"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AuthLogo } from "./AuthIcons";
import { brutalistCard, brutalistCardFrame, brutalistFooter, brutalistLink, brutalistLogoTile, brutalistSubtitle, brutalistTitle } from "./authStyles";

/**
 * The shell the three account-recovery screens sit in.
 *
 * They are the same shape as the login card and stand next to it in the flow, so they borrow its
 * frame rather than inventing a second look for pages nobody visits twice.
 */
export default function AuthNotice({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className={cn(brutalistCard, brutalistCardFrame)}>
          <CardHeader className="space-y-3">
            <div className="flex justify-center">
              <span className={brutalistLogoTile}>
                <AuthLogo />
              </span>
            </div>
            <h1 className={cn(brutalistTitle, "text-center")}>{title}</h1>
            {subtitle ? <p className={cn(brutalistSubtitle, "text-center")}>{subtitle}</p> : null}
          </CardHeader>
          {children ? <CardContent className="space-y-4">{children}</CardContent> : null}
          <CardFooter className={brutalistFooter}>
            {footer ?? (
              <p className="text-pretty text-center text-gray-600 text-sm">
                <Link className={brutalistLink} href="/login">
                  Back to sign in
                </Link>
              </p>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
