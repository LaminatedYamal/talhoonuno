import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  subDays,
  format,
  parseISO,
} from "date-fns";

export type Invoice = {
  id: string;
  customer_name: string;
  invoice_date: string;
  amount: number;
  paid: boolean;
  notes: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  expense_date: string;
  category: "meat_purchases" | "supplies" | "utilities" | "wages" | "rent" | "other";
  amount: number;
  paid: boolean;
  notes: string | null;
  created_at: string;
};

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,customer_name,invoice_date,amount,paid,notes,created_at")
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, amount: Number(d.amount) })) as Invoice[];
    },
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id,expense_date,category,amount,paid,notes,created_at")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, amount: Number(d.amount), paid: d.paid ?? true })) as Expense[];
    },
  });
}

export function sumInRange<T extends { amount: number }>(
  rows: T[] | undefined,
  getDate: (r: T) => string,
  start: Date,
  end: Date,
) {
  if (!rows) return 0;
  return rows.reduce((acc, r) => {
    const d = parseISO(getDate(r));
    return d >= start && d <= end ? acc + r.amount : acc;
  }, 0);
}

export function useDateRanges() {
  const now = new Date();
  return {
    todayStart: startOfDay(now),
    todayEnd: endOfDay(now),
    weekStart: startOfWeek(now, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(now, { weekStartsOn: 1 }),
    monthStart: startOfMonth(now),
    monthEnd: endOfMonth(now),
  };
}

export function trendLast30Days(invoices?: Invoice[], expenses?: Expense[]) {
  const days: { date: string; label: string; revenue: number; expenses: number; profit: number }[] =
    [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = startOfDay(subDays(today, i));
    const key = format(d, "yyyy-MM-dd");
    days.push({ date: key, label: format(d, "MMM d"), revenue: 0, expenses: 0, profit: 0 });
  }
  const map = new Map(days.map((d) => [d.date, d]));
  invoices?.forEach((i) => {
    const e = map.get(i.invoice_date);
    if (e) e.revenue += i.amount;
  });
  expenses?.forEach((x) => {
    const e = map.get(x.expense_date);
    if (e) e.expenses += x.amount;
  });
  days.forEach((d) => (d.profit = d.revenue - d.expenses));
  return days;
}
