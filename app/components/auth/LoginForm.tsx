"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "react-toastify";
import { signIn } from "@/app/lib/authClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AuthLogo, GitHubIcon, GoogleIcon } from "./AuthIcons";
import {
  AuthDivider,
  brutalistCard,
  brutalistCardFrame,
  brutalistFooter,
  brutalistInput,
  brutalistLink,
  brutalistLogoTile,
} from "./authStyles";

interface LoginFormProps {
  /** Called after a successful credentials sign-in instead of navigating to "/". */
  onSuccess?: () => void;
  /** When set, the "Sign up" link switches views instead of navigating to /signup. */
  onSwitchToSignup?: () => void;
  /** Where OAuth providers land after sign-in. */
  oauthCallbackUrl?: string;
  /** Keeps input ids unique when the form renders both in a page and a dialog. */
  idPrefix?: string;
  /** Drops the card frame when rendered inside the auth dialog (the dialog draws it instead). */
  embedded?: boolean;
}

export default function LoginForm({
  onSuccess,
  onSwitchToSignup,
  oauthCallbackUrl = "/",
  idPrefix = "login",
  embedded = false,
}: LoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCredentialsLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        toast.error("Wrong email or password");
        return;
      }
      toast.success("Signed in successfully");
      if (onSuccess) {
        onSuccess();
        router.refresh();
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };
  console.log(idPrefix);

  return (
    <Card className={cn(brutalistCard, !embedded && brutalistCardFrame)}>
      <CardHeader className="flex flex-col items-center space-y-3 px-8 pt-8 pb-4 text-center">
        <div className={brutalistLogoTile}>
          <AuthLogo aria-hidden={true} className="h-9 w-9 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-balance font-bold text-2xl text-primary">Sign in to your account</h2>
          <p className="text-pretty text-gray-600 text-sm">Welcome back! Sign in to continue.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <Button
            className="w-full flex-1 bg-white font-bold"
            onClick={() => signIn("github", { callbackUrl: oauthCallbackUrl })}
            type="button"
            variant="brutalist">
            <GitHubIcon aria-hidden={true} className="size-4" />
            <span className="text-sm">Login with GitHub</span>
          </Button>
          <Button
            className="w-full flex-1 bg-white font-bold"
            onClick={() => signIn("google", { callbackUrl: oauthCallbackUrl })}
            type="button"
            variant="brutalist">
            <GoogleIcon aria-hidden={true} className="size-4" />
            <span className="text-sm">Login with Google</span>
          </Button>
        </div>

        <AuthDivider />

        <form className="space-y-5" onSubmit={handleCredentialsLogin}>
          <div className="space-y-2">
            <Label className="font-bold" htmlFor={`email-${idPrefix}`}>
              Email
            </Label>
            <Input
              autoComplete="email"
              className={brutalistInput}
              id={`email-${idPrefix}`}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold" htmlFor={`password-${idPrefix}`}>
              Password
            </Label>
            <div className="relative">
              <Input
                autoComplete="current-password"
                className={cn(brutalistInput, "pr-10")}
                id={`password-${idPrefix}`}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <Button
                className="absolute top-0 right-0 h-full px-3 text-primary hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                size="icon"
                type="button"
                variant="ghost">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button className="w-full rounded-md font-bold" disabled={submitting} type="submit" variant="brutalist-accent">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className={brutalistFooter}>
        <p className="text-pretty text-center text-gray-600 text-sm">
          Don&apos;t have an account?{" "}
          {onSwitchToSignup ? (
            <button className={brutalistLink} onClick={onSwitchToSignup} type="button">
              Sign up
            </button>
          ) : (
            <Link className={brutalistLink} href="/signup">
              Sign up
            </Link>
          )}
        </p>
      </CardFooter>
    </Card>
  );
}
