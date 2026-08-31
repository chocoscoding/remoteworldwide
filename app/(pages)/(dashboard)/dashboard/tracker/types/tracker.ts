import type { LucideIcon } from "lucide-react";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import type { TrackerColumn, TrackerColumnId } from "@/app/lib/dashboard/types";
import type { TrackerCard as TrackerCardData } from "@/app/lib/dashboard/types";

export type TrackerView = "board" | "table" | "calendar";

export interface ViewConfig {
  id: TrackerView;
  label: string;
  icon: LucideIcon;
}

export type TrackerEventType = "saved" | "applied" | "interview" | "deadline";

export interface TrackerEvent {
  id: string;
  date: Date;
  cardId: string;
  company: string;
  title: string;
  type: TrackerEventType;
  columnId: TrackerColumnId;
  rww?: boolean;
  /** Extra caption text for interview/deadline events, e.g. the full status chip. */
  detail?: string;
}

export type TableSortKey = "company" | "role" | "status" | "daysAgo";

export type SortDirection = "asc" | "desc";

export interface TableSort {
  key: TableSortKey;
  direction: SortDirection;
}

export interface ChipMetaResult {
  variant: NonNullable<PillProps["variant"]>;
  icon: LucideIcon;
}

// Re-exports for convenience
export type { TrackerCardData, TrackerColumn, TrackerColumnId };
