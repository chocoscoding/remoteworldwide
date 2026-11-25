// Brutalist building blocks shared by the login/signup forms and the auth
// dialog so every auth surface keeps the same look.
export const brutalistCard = "rounded-lg border-none bg-white text-primary shadow-none";
export const brutalistCardFrame = "outline outline-2 outline-black drop-shadow-primary";

// Short windows (owner, 2026-11-25): the auth dialog has to fit the screen's height, so the
// spacing tightens on windows under 861px tall and again under 721px. Anything still taller than
// the window scrolls inside the dialog (AuthModalProvider). Spacing that steps twice is written
// compact first and grows with min-height, like sm:/md:: Tailwind orders these arbitrary variants
// by name, so two overlapping max-height steps would let the 860px one win on the shortest
// windows. One-step tweaks below use max-height. Literal strings, so Tailwind sees them.
export const authHeader =
  "flex flex-col items-center space-y-1 px-8 pt-3 pb-2 text-center sm:text-center [@media(min-height:721px)]:space-y-2 [@media(min-height:721px)]:pt-6 [@media(min-height:721px)]:pb-3 [@media(min-height:861px)]:space-y-3 [@media(min-height:861px)]:pt-8 [@media(min-height:861px)]:pb-4";
export const authLogo = "h-9 w-9 text-primary [@media(max-height:860px)]:h-7 [@media(max-height:860px)]:w-7";
export const authBody =
  "space-y-3 px-8 pb-3 [@media(min-height:721px)]:space-y-4 [@media(min-height:721px)]:pb-5 [@media(min-height:861px)]:space-y-6 [@media(min-height:861px)]:pb-8";
export const authForm = "space-y-2.5 [@media(min-height:721px)]:space-y-3 [@media(min-height:861px)]:space-y-5";
export const authField = "space-y-1 [@media(min-height:721px)]:space-y-1.5 [@media(min-height:861px)]:space-y-2";
export const authSubmit = "[@media(max-height:720px)]:h-9";

export const brutalistInput =
  "h-10 rounded-md border-2 border-black bg-white shadow-none transition-all placeholder:text-gray-500 focus-visible:shadow-[3px_3px_0_0_#e1f073] focus-visible:ring-0 [@media(max-height:720px)]:h-9";
export const brutalistCheckbox =
  "rounded-[3px] border-2 br-shadow data-[state=checked]:bg-secondary data-[state=checked]:text-primary";
export const brutalistLink = "font-medium text-primary underline decoration-1 underline-offset-2 transition-colors hover:bg-secondary";
export const brutalistLogoTile = " bg-white p-2 [@media(max-height:720px)]:p-1";
// Title/subtitle/footer render under Card* on pages and Dialog* in the modal, so
// these also neutralize the diverging defaults of both bases (leading/tracking on
// DialogTitle, flex-col-reverse + sm:justify-end on DialogFooter).
export const brutalistTitle =
  "text-balance font-bold text-2xl leading-8 tracking-normal text-primary [@media(max-height:720px)]:text-xl [@media(max-height:720px)]:leading-7";
// The welcome line is the first thing to go on a short window; screen readers still get it.
export const brutalistSubtitle = "text-pretty text-gray-600 text-sm [@media(max-height:720px)]:sr-only";
export const brutalistFooter =
  "flex flex-row items-center justify-center sm:justify-center rounded-b-lg border-t-2 border-black bg-primary2 px-6 py-2 [@media(min-height:721px)]:py-3 [@media(min-height:861px)]:py-4";

/**
 * Why a sign-in or sign-up was refused, inside the form, right above its button (owner, 2026-10-13):
 * a toast in the corner sat under the cookie card and the extension's button, so a wrong password
 * looked like nothing happened. Nothing renders without a message.
 */
export const AuthFormError = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="rounded-md border-2 border-[#b23c26] bg-[#fdf1ee] px-3 py-2 font-semibold text-[#b23c26] text-sm">
      {message}
    </p>
  ) : null;

/** A field's own problem, under the field (an email that isn't complete). Nothing renders without one. */
export const AuthFieldError = ({ id, message }: { id: string; message: string | null }) =>
  message ? (
    <p id={id} className="font-semibold text-[#b23c26] text-xs">
      {message}
    </p>
  ) : null;

/** The red edge an input takes while its AuthFieldError shows. */
export const brutalistInputInvalid = "border-[#b23c26] focus-visible:shadow-[3px_3px_0_0_#f3c4b8]";

export const AuthDivider = () => (
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="h-0.5 w-full bg-black" />
    </div>
    <div className="relative flex justify-center">
      <span className="bg-white px-3 font-bold text-primary text-xs uppercase tracking-widest">or</span>
    </div>
  </div>
);
