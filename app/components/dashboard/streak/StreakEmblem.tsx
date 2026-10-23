"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export default function StreakEmblem({ days, className, active = true }: { days: number; className?: string; active?: boolean }) {
  const id = useId();
  const reduced = useReducedMotion();
  const playing = active && !reduced;
  const violet = days >= 60;
  return (
    <motion.div aria-hidden className={cn("flex items-center justify-center", className)} initial={false} animate={{ scale: 1, opacity: 1 }}>
      <svg viewBox="0 0 160 160" className="h-full w-full overflow-visible" fill="none">
        <defs>
          <linearGradient id={id + "-flame"} x1="80" y1="25" x2="80" y2="134" gradientUnits="userSpaceOnUse">
            <stop stopColor={violet ? "#e9b8ff" : "#ffe59b"} />
            <stop offset="0.48" stopColor={violet ? "#bd7aff" : "#ffad42"} />
            <stop offset="1" stopColor={violet ? "#7045eb" : "#f55b30"} />
          </linearGradient>
          <radialGradient id={id + "-halo"}><stop stopColor={violet ? "#a879ff" : "#ffae42"} stopOpacity="0.24" /><stop offset="1" stopColor="#ffae42" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="80" cy="80" r="78" fill={"url(#" + id + "-halo)"} />
        <circle cx="80" cy="80" r="65" stroke={violet ? "#bf94ff" : "#e8b76b"} strokeOpacity="0.25" />
        <circle cx="80" cy="80" r="73" stroke="#e8b76b" strokeOpacity="0.15" strokeDasharray="2 9" />
        <motion.path
          d="M84 25C91 49 114 54 108 77C115 73 118 66 117 62C144 98 118 133 82 134C44 135 24 104 42 77C45 89 51 92 55 91C43 64 75 57 84 25Z"
          fill={"url(#" + id + "-flame)"} stroke="#fff0c2" strokeOpacity="0.3" strokeWidth="1.5"
          style={{ originX: "50%", originY: "100%" }}
          animate={!playing ? { scaleX: 1, scaleY: 1, skewX: 0 } : { scaleX: [1, 0.96, 1.03, 0.98, 1], scaleY: [1, 1.06, 0.97, 1.04, 1], skewX: [0, -2, 1.5, -1, 0] }}
          transition={{ duration: playing ? 1.7 : 0, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
        />
        <motion.path d="M83 77C84 92 103 98 98 113C95 124 82 128 72 122C59 113 67 99 73 95C72 104 76 106 78 104C74 94 81 87 83 77Z" fill="#fff1b2"
          style={{ originX: "50%", originY: "100%" }}
          animate={!playing ? { scaleY: 1, opacity: 1 } : { scaleY: [1, 0.84, 1.14, 0.94, 1], opacity: [1, 0.8, 1, 0.9, 1] }}
          transition={{ duration: playing ? 1.1 : 0, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
        />
        {playing && [0, 1, 2].map((spark) => <motion.circle key={spark} cx={65 + spark * 15} cy="60" r={spark === 1 ? 2 : 1.5} fill="#ffd87a"
          animate={{ y: [0, -35], x: [0, spark === 1 ? 5 : -5], opacity: [0, 0.8, 0], scale: [0.5, 1, 0.3] }}
          transition={{ duration: 1.8, delay: spark * 0.6, repeat: Infinity, ease: "easeOut" }} />)}
        <path d="M34 40V48M30 44H38M123 111V119M119 115H127" stroke="#ffe6a3" strokeWidth="2" strokeLinecap="round" />
        <circle cx="121" cy="42" r="2.5" fill="#ffcf77" /><circle cx="37" cy="119" r="2" fill="#ffcf77" />
      </svg>
    </motion.div>
  );
}
