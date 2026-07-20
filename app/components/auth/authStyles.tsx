// Brutalist building blocks shared by the login/signup forms and the auth
// dialog so every auth surface keeps the same look.
export const brutalistCard = "rounded-lg border-none bg-white text-primary shadow-none";
export const brutalistCardFrame = "outline outline-2 outline-black drop-shadow-primary";
export const brutalistInput =
  "h-10 rounded-md border-2 border-black bg-white shadow-none transition-all placeholder:text-gray-500 focus-visible:shadow-[3px_3px_0_0_#e1f073] focus-visible:ring-0";
export const brutalistCheckbox =
  "rounded-[4px] border-2 border-black shadow-none data-[state=checked]:bg-secondary data-[state=checked]:text-primary";
export const brutalistLink = "font-medium text-primary underline decoration-1 underline-offset-2 transition-colors hover:bg-secondary";
export const brutalistLogoTile = " bg-white p-2";
// Title/subtitle/footer render under Card* on pages and Dialog* in the modal, so
// these also neutralize the diverging defaults of both bases (leading/tracking on
// DialogTitle, flex-col-reverse + sm:justify-end on DialogFooter).
export const brutalistTitle = "text-balance font-bold text-2xl leading-8 tracking-normal text-primary";
export const brutalistSubtitle = "text-pretty text-gray-600 text-sm";
export const brutalistFooter =
  "flex flex-row items-center justify-center sm:justify-center rounded-b-lg border-t-2 border-black bg-primary2 px-6 py-4";

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
