import { DateRange } from "react-day-picker";

export const DEFAULT_START_DATE = { year: 2023, month: 12, day: 31 };

export const createLocalDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

export const getDefaultRange = (): DateRange => ({
  from: createLocalDate(DEFAULT_START_DATE.year, DEFAULT_START_DATE.month, DEFAULT_START_DATE.day),
  to: new Date(),
});

export const normalizeDateRange = (range?: DateRange) => {
  if (!range?.from || !range?.to) return range;
  return range.from <= range.to ? range : { from: range.to, to: range.from };
};

export const formatDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateParam = (value?: string | null) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return createLocalDate(year, month, day);
};

export const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

export const isDefaultRange = (range?: DateRange) => {
  if (!range?.from || !range?.to) return false;
  const defaultRange = getDefaultRange();
  return isSameDay(range.from as Date, defaultRange.from as Date) && isSameDay(range.to as Date, defaultRange.to as Date);
};
