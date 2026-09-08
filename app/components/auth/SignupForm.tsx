"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ElementType, type FormEvent, useState } from "react";
import { toast } from "react-toastify";
import { signIn } from "@/app/lib/authClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { evaluatePassword, MIN_PASSWORD_LENGTH } from "@/app/lib/auth/password-strength";
import { AuthLogo, GitHubIcon, GoogleIcon } from "./AuthIcons";
import PasswordStrength from "./PasswordStrength";
import {
  AuthDivider,
  brutalistCard,
  brutalistCardFrame,
  brutalistCheckbox,
  brutalistFooter,
  brutalistInput,
  brutalistLink,
  brutalistLogoTile,
  brutalistSubtitle,
  brutalistTitle,
} from "./authStyles";

interface SignupFormProps {
  /** Called after a successful signup + sign-in instead of navigating to "/". */
  onSuccess?: () => void;
  /** When set, "Sign in" links switch views instead of navigating to /login. */
  onSwitchToLogin?: () => void;
  oauthCallbackUrl?: string;
  /** Keeps input ids unique when the form renders both in a page and a dialog. */
  idPrefix?: string;
  /** Inside the auth dialog: compose from Dialog primitives / plain divs instead of Card, and let the dialog draw the frame. */
  embedded?: boolean;
}

export default function SignupForm({
  onSuccess,
  onSwitchToLogin,
  oauthCallbackUrl = "/",
  idPrefix = "signup",
  embedded = false,
}: SignupFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Latches on first focus. The checklist stays up while there's a password to
  // check it against, so moving to the confirm field doesn't hide the rules
  // the user is still reading.
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = evaluatePassword(password);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const confirmed = confirmPassword.length > 0 && confirmPassword === password;
  // Derived, never stored — no effect can leave it stale.
  const canSubmit = strength.meetsRequirements && confirmed && agreed && !submitting;

  // Same markup, two skins: Card pieces on the standalone page, Dialog pieces
  // (with their aria wiring) when rendered inside the auth dialog.
  const Root: ElementType = embedded ? "div" : Card;
  const Header: ElementType = embedded ? DialogHeader : CardHeader;
  const Body: ElementType = embedded ? "div" : CardContent;
  const Footer: ElementType = embedded ? DialogFooter : CardFooter;
  const Title: ElementType = embedded ? DialogTitle : "h2";
  const Subtitle: ElementType = embedded ? DialogDescription : "p";

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Checked here as well as on the button: the form can still be submitted
    // by pressing Enter in a field, which bypasses a disabled button.
    if (!strength.meetsRequirements) {
      setPasswordTouched(true);
      toast.error("Your password doesn't meet the requirements yet");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Those passwords don't match");
      return;
    }
    if (!agreed) {
      toast.error("Please accept the Terms and Conditions and the Privacy Policy");
      return;
    }
    setSubmitting(true);
    try {
      // Registration is a plain backend endpoint (proxied, no session issued);
      // signing in afterwards goes through Auth.js like every other login.
      const response = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.message ?? "Could not create your account");
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        toast.error("Account created — please sign in");
        if (onSwitchToLogin) {
          onSwitchToLogin();
        } else {
          router.push("/login");
        }
        return;
      }
      toast.success("Account created successfully");
      if (onSuccess) {
        onSuccess();
        router.refresh();
        return;
      }
      router.push(oauthCallbackUrl);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Root className={cn(brutalistCard, !embedded && brutalistCardFrame)}>
      <Header className="flex flex-col items-center space-y-3 px-8 pt-8 pb-4 text-center sm:text-center">
        <div className={brutalistLogoTile}>
          <AuthLogo aria-hidden={true} className="h-9 w-9 text-primary" />
        </div>
        <div className="space-y-1">
          <Title className={brutalistTitle}>Create an account</Title>
          <Subtitle className={brutalistSubtitle}>Welcome! Create an account to get started.</Subtitle>
        </div>
      </Header>
      <Body className="space-y-6 px-8 pb-8">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <Button
            className="w-full flex-1 bg-white font-bold"
            onClick={() => signIn("github", { callbackUrl: oauthCallbackUrl })}
            type="button"
            variant="brutalist">
            <GitHubIcon aria-hidden={true} className="size-4" />
            <span className="text-sm">Sign up with GitHub</span>
          </Button>
          <Button
            className="w-full flex-1 bg-white font-bold"
            onClick={() => signIn("google", { callbackUrl: oauthCallbackUrl })}
            type="button"
            variant="brutalist">
            <GoogleIcon aria-hidden={true} className="size-4" />
            <span className="text-sm">Sign up with Google</span>
          </Button>
        </div>

        <AuthDivider />

        <form className="space-y-5" onSubmit={handleSignup}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold" htmlFor={`firstName-${idPrefix}`}>
                First name
              </Label>
              <Input
                className={brutalistInput}
                id={`firstName-${idPrefix}`}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="John"
                required
                value={firstName}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold" htmlFor={`lastName-${idPrefix}`}>
                Last name
              </Label>
              <Input
                className={brutalistInput}
                id={`lastName-${idPrefix}`}
                onChange={(event) => setLastName(event.target.value)}
                required
                value={lastName}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold" htmlFor={`email-${idPrefix}`}>
              Email address
            </Label>
            <Input
              autoComplete="email"
              className={brutalistInput}
              id={`email-${idPrefix}`}
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
                aria-describedby={`password-rules-${idPrefix}`}
                autoComplete="new-password"
                className={cn(brutalistInput, "pr-10")}
                id={`password-${idPrefix}`}
                minLength={MIN_PASSWORD_LENGTH}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={() => setPasswordTouched(true)}
                placeholder="********"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <Button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-0 right-0 h-full px-3 text-primary hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                size="icon"
                type="button"
                variant="ghost">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            {/* Appears on first focus and stays while there's something to
                check. One eye toggle governs both fields — they have to match,
                so revealing one and not the other helps nobody. */}
            <PasswordStrength id={`password-rules-${idPrefix}`} open={passwordTouched} password={password} />
          </div>

          <div className="space-y-2">
            <Label className="font-bold" htmlFor={`confirmPassword-${idPrefix}`}>
              Confirm password
            </Label>
            <div className="relative">
              <Input
                aria-invalid={mismatch}
                autoComplete="new-password"
                className={cn(brutalistInput, "pr-10", mismatch && "border-[#b23c26]")}
                id={`confirmPassword-${idPrefix}`}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="********"
                required
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
              />
              {confirmed && (
                <span
                  aria-hidden
                  className="absolute top-0 right-0 grid h-full place-content-center px-3 text-[#6c7a1e]"
                  data-passwords-match="">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </div>
            {/* Only ever says "they don't match" while they don't — it never
                complains about an unfinished password mid-typing beyond that. */}
            {mismatch && (
              <p className="text-[11px] font-semibold text-[#b23c26]" data-passwords-mismatch="">
                Those passwords don&apos;t match yet.
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              checked={agreed}
              className={brutalistCheckbox}
              id={`terms-${idPrefix}`}
              onCheckedChange={(checked) => setAgreed(checked === true)}
            />
            <label className="text-gray-600 text-sm" htmlFor={`terms-${idPrefix}`}>
              I agree to the{" "}
              <Link className={brutalistLink} href="/terms" target="_blank" rel="noopener noreferrer">
                Terms and Conditions
              </Link>{" "}
              and the{" "}
              <Link className={brutalistLink} href="/privacy-policy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
            </label>
          </div>

          <Button
            className="w-full rounded-md disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit}
            size={"lg"}
            type="submit"
            variant="brutalist-accent">
            {submitting ? "Creating account…" : "Create free account"}
          </Button>
        </form>
      </Body>
      <Footer className={brutalistFooter}>
        <p className="text-pretty text-center text-gray-600 text-sm">
          Already have an account?{" "}
          {onSwitchToLogin ? (
            <button className={brutalistLink} onClick={onSwitchToLogin} type="button">
              Sign in
            </button>
          ) : (
            <Link className={brutalistLink} href="/login">
              Sign in
            </Link>
          )}
        </p>
      </Footer>
    </Root>
  );
}
