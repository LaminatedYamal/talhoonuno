import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  format,
} from "date-fns";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export type PresetKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "all"
  | "custom";

type Range = { from: string; to: string };

export const datePresets: Record<Exclude<PresetKey, "custom">, () => Range> = {
  today: () => {
    const n = new Date();
    return { from: fmt(startOfDay(n)), to: fmt(endOfDay(n)) };
  },
  yesterday: () => {
    const n = subDays(new Date(), 1);
    return { from: fmt(startOfDay(n)), to: fmt(endOfDay(n)) };
  },
  this_week: () => {
    const n = new Date();
    return {
      from: fmt(startOfWeek(n, { weekStartsOn: 1 })),
      to: fmt(endOfWeek(n, { weekStartsOn: 1 })),
    };
  },
  last_week: () => {
    const n = subWeeks(new Date(), 1);
    return {
      from: fmt(startOfWeek(n, { weekStartsOn: 1 })),
      to: fmt(endOfWeek(n, { weekStartsOn: 1 })),
    };
  },
  this_month: () => {
    const n = new Date();
    return { from: fmt(startOfMonth(n)), to: fmt(endOfMonth(n)) };
  },
  last_month: () => {
    const n = subMonths(new Date(), 1);
    return { from: fmt(startOfMonth(n)), to: fmt(endOfMonth(n)) };
  },
  this_year: () => {
    const n = new Date();
    return { from: fmt(startOfYear(n)), to: fmt(endOfYear(n)) };
  },
  all: () => ({ from: "1970-01-01", to: "2999-12-31" }),
};
