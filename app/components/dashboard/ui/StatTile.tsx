import { FC } from "react";
import { cn } from "@/lib/utils";
import DashCard from "./DashCard";

/**
 * `DashCard`-based stat tile: small muted label, big bold number, and an
 * optional delta line (green when `deltaTone="positive"`, muted otherwise).
 * Used for the Home screen's 4-up stat row (Applications / Reply rate /
 * Interviews / Avg ATS score) and similar summary rows elsewhere.
 */
export type StatTileDeltaTone = "positive" | "neutral";

export interface StatTileProps {
  /** Small muted label above the number, e.g. "Applications". */
  label: string;
  /** The big number/value, e.g. 34, "21%", "78". */
  value: string | number;
  /** Optional delta/context line under the number, e.g. "+5 this week". */
  delta?: string;
  /** Controls delta color: green `#6c7a1e` for "positive", muted grey for "neutral" (default). */
  deltaTone?: StatTileDeltaTone;
  className?: string;
}

const StatTile: FC<StatTileProps> = ({ label, value, delta, deltaTone = "neutral", className }) => {
  return (
    <DashCard className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-[11.5px] font-medium text-black/50">{label}</p>
      <p className="text-[28px] font-bold text-primary leading-none">{value}</p>
      {delta ? <p className={cn("text-xs font-medium", deltaTone === "positive" ? "text-[#6c7a1e]" : "text-black/45")}>{delta}</p> : null}
    </DashCard>
  );
};

export default StatTile;
