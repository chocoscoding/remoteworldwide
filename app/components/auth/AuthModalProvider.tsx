"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";

type AuthView = "login" | "signup";

interface AuthModalContextType {
  openAuthModal: (view?: AuthView) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export const AuthModalProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AuthView>("login");
  // OAuth redirects the whole page, so send the user back to where they opened the popup.
  const pathname = usePathname();

  const openAuthModal = useCallback((nextView: AuthView = "login") => {
    setView(nextView);
    setOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openAuthModal, closeAuthModal }), [openAuthModal, closeAuthModal]);

  return (
    <AuthModalContext.Provider value={value}>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90dvh] w-[92vw] max-w-lg  rounded-lg border-2 border-black bg-white p-0 shadow-none drop-shadow-primary2">
          {view === "login" && open ? (
            <LoginForm
              idPrefix="dialog-login"
              oauthCallbackUrl={pathname}
              onSuccess={closeAuthModal}
              onSwitchToSignup={() => setView("signup")}
            />
          ) : null}

          {view === "signup" && open ? (
            <SignupForm
              embedded
              idPrefix="dialog-signup"
              oauthCallbackUrl={pathname}
              onSuccess={closeAuthModal}
              onSwitchToLogin={() => setView("login")}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = (): AuthModalContextType => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
};
