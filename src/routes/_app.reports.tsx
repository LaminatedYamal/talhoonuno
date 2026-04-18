import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  differenceInCalendarDays,
} from "date-fns";
import { pt as ptLocale, enUS as enLocale } from "date-fns/locale";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvoices, useExpenses } from "@/lib/data-hooks";
import { useCurrency, useI18n } from "@/i18n/I18nProvider";
import { datePresets, type PresetKey } from "@/lib/date-presets";
import { type ExpenseCategory } from "@/lib/format";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

type Group = "day" | "week" | "month";

function ReportsPage() {
  const { data: invoices } = useInvoices();
  const { data: expenses } = useExpenses();
  const { t, lang } = useI18n();
  const currency = useCurrency();
  const dLocale = lang === "pt" ? ptLocale : enLocale;

  const [preset, setPreset] = useState<PresetKey>("this_month");
  const initial = datePresets["this_month"]();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [group, setGroup] = useState<Group>("day");

  const range = useMemo(() => {
    if (preset === "custom") return { from, to };
    return datePresets[preset]();
  }, [preset, from, to]);

  const inRange = useMemo(() => {
    const inv = (invoices ?? []).filter(
      (i) => i.invoice_date >= range.from && i.invoice_date <= range.to,
    );
    const exp = (expenses ?? []).filter(
      (e) => e.expense_date >= range.from && e.expense_date <= range.to,
    );
    return { inv, exp };
  }, [invoices, expenses, range]);

  const totals = useMemo(() => {
    const revenue = inRange.inv.reduce((a, i) => a + i.amount, 0);
    const exp = inRange.exp.reduce((a, e) => a + e.amount, 0);
    const profit = revenue - exp;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const paid = inRange.inv.filter((i) => i.paid).reduce((a, i) => a + i.amount, 0);
    const unpaid = revenue - paid;
    const days = Math.max(
      1,
      differenceInCalendarDays(parseISO(range.to), parseISO(range.from)) + 1,
    );
    return {
      revenue,
      exp,
      profit,
      margin,
      paid,
      unpaid,
      avgRevPerDay: revenue / days,
      avgExpPerDay: exp / days,
      avgProfitPerDay: profit / days,
      txCount: inRange.inv.length + inRange.exp.length,
      avgRev: inRange.inv.length ? revenue / inRange.inv.length : 0,
      avgExp: inRange.exp.length ? exp / inRange.exp.length : 0,
    };
  }, [inRange, range]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    inRange.exp.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return Array.from(m.entries())
      .map(([k, v]) => ({ category: t.expenseCat[k as ExpenseCategory], amount: v }))
      .sort((a, b) => b.amount - a.amount);
  }, [inRange, t]);

  const grouped = useMemo(() => {
    const bucket = (iso: string) => {
      const d = parseISO(iso);
      if (group === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      if (group === "month") return format(startOfMonth(d), "yyyy-MM");
      return iso;
    };
    const labelFor = (key: string) => {
      if (group === "month") return format(parseISO(key + "-01"), "MMM yyyy", { locale: dLocale });
      if (group === "week") return format(parseISO(key), "d MMM", { locale: dLocale });
      return format(parseISO(key), "d MMM", { locale: dLocale });
    };
    const map = new Map<
      string,
      { key: string; label: string; revenue: number; expenses: number; profit: number }
    >();
    inRange.inv.forEach((i) => {
      const k = bucket(i.invoice_date);
      const e = map.get(k) ?? { key: k, label: labelFor(k), revenue: 0, expenses: 0, profit: 0 };
      e.revenue += i.amount;
      map.set(k, e);
    });
    inRange.exp.forEach((x) => {
      const k = bucket(x.expense_date);
      const e = map.get(k) ?? { key: k, label: labelFor(k), revenue: 0, expenses: 0, profit: 0 };
      e.expenses += x.amount;
      map.set(k, e);
    });
    const arr = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
    arr.forEach((d) => (d.profit = d.revenue - d.expenses));
    return arr;
  }, [inRange, group, dLocale]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.reports.title}</h1>
        <p className="text-sm text-muted-foreground">{t.reports.subtitle}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">{t.reports.preset}</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{t.reports.today}</SelectItem>
                  <SelectItem value="yesterday">{t.reports.yesterday}</SelectItem>
                  <SelectItem value="this_week">{t.reports.thisWeek}</SelectItem>
                  <SelectItem value="last_week">{t.reports.lastWeek}</SelectItem>
                  <SelectItem value="this_month">{t.reports.thisMonth}</SelectItem>
                  <SelectItem value="last_month">{t.reports.lastMonth}</SelectItem>
                  <SelectItem value="this_year">{t.reports.thisYear}</SelectItem>
                  <SelectItem value="all">{t.expenses.allCategories /* all */}</SelectItem>
                  <SelectItem value="custom">{t.reports.custom}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.common.from}</Label>
              <Input
                type="date"
                value={preset === "custom" ? from : range.from}
                disabled={preset !== "custom"}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.common.to}</Label>
              <Input
                type="date"
                value={preset === "custom" ? to : range.to}
                disabled={preset !== "custom"}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.reports.grouping}</Label>
              <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">{t.reports.day}</SelectItem>
                  <SelectItem value="week">{t.reports.week}</SelectItem>
                  <SelectItem value="month">{t.reports.month}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={t.reports.revenue} value={currency(totals.revenue)} />
        <SummaryCard label={t.reports.expenses} value={currency(totals.exp)} />
        <SummaryCard
          label={t.reports.profit}
          value={currency(totals.profit)}
          tone={totals.profit >= 0 ? "success" : "destructive"}
        />
        <SummaryCard
          label={t.reports.margin}
          value={totals.revenue > 0 ? `${totals.margin.toFixed(1)}%` : "—"}
          tone={totals.profit >= 0 ? "success" : "destructive"}
        />
      </div>


      <Card>
        <CardHeader>
          <CardTitle>{t.reports.revVsExp}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {grouped.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t.common.noData}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grouped} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => currency(Number(v))}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name={t.reports.revenue} fill="var(--color-primary)" radius={4} />
                  <Bar dataKey="expenses" name={t.reports.expenses} fill="var(--color-gold)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.reports.profit}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {grouped.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t.common.noData}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={grouped} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => currency(Number(v))}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name={t.reports.profit}
                    stroke="var(--color-primary-glow)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.reports.byCategory}</CardTitle>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t.reports.noneCategory}
            </p>
          ) : (
            <ul className="divide-y">
              {byCategory.map((b) => {
                const pct = totals.exp > 0 ? (b.amount / totals.exp) * 100 : 0;
                return (
                  <li key={b.category} className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{b.category}</span>
                      <span className="font-semibold">{currency(b.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pct.toFixed(1)}% {t.reports.ofExpenses}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={
            "mt-1 text-3xl font-black " +
            (tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function SmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={
            "mt-1 text-lg font-semibold " +
            (tone === "success"
              ? "text-success"
              : tone === "warning"
                ? "text-warning"
                : tone === "destructive"
                  ? "text-destructive"
                  : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
