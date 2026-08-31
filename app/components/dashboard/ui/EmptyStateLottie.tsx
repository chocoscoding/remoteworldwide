"use client";

import { FC } from "react";
import { Lottie } from "lottie-react";

/**
 * The animated figure an empty state can show instead of a static icon.
 *
 * Split out as its own client component so `DashEmptyState` — rendered from
 * both server and client trees — doesn't have to become a client component
 * just to carry one.
 *
 * Playback settings match the established call sites (ATS landing, Ask about
 * a job): autoplay, looping, slowed to 0.63 so it reads as ambient rather
 * than something demanding attention.
 */
export interface EmptyStateLottieProps {
  /** Public path, e.g. `/Lottie/neobrutalism/Image_Folder_lottie.json`. */
  src: string;
  /** Square edge in px. Smaller here than the full-page landings by default —
   *  this sits inside a list that already has a header, tabs and search. */
  size?: number;
}

const EmptyStateLottie: FC<EmptyStateLottieProps> = ({ src, size = 200 }) => (
  <span aria-hidden className="flex items-center justify-center">
    <Lottie src={src} autoplay loop speed={0.63} style={{ width: size, height: size }} />
  </span>
);

export default EmptyStateLottie;
