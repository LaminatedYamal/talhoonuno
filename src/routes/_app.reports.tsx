import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvoices, useExpenses } from "@/lib/data-hooks";
import { currency, expenseCategoryLabel } from "@/lib/format";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data: invoices } = useInvoices();
  const { data: expenses } = useExpenses();
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const inRange = useMemo(() => {
    const inv = (invoices ?? []).filter((i) => i.invoice_date >= from && i.invoice_date <= to);
    const exp = (expenses ?? []).filter((e) => e.expense_date >= from && e.expense_date <= to);
    return { inv, exp };
  }, [invoices, expenses, from, to]);

  const totals = useMemo(() => {
    const revenue = inRange.inv.reduce((a, i) => a + i.amount, 0);
    const exp = inRange.exp.reduce((a, e) => a + e.amount, 0);
    const profit = revenue - exp;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const paid = inRange.inv.filter((i) => i.paid).reduce((a, i) => a + i.amount, 0);
    const unpaid = revenue - paid;
    return { revenue, exp, profit, margin, paid, unpaid };
  }, [inRange]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    inRange.exp.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return Array.from(m.entries())
      .map(([k, v]) => ({ category: expenseCategoryLabel(k), amount: v }))
      .sort((a, b) => b.amount - a.amount);
  }, [inRange]);

  const daily = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; expenses: number }>();
    inRange.inv.forEach((i) => {
      const e = map.get(i.invoice_date) ?? { date: i.invoice_date, revenue: 0, expenses: 0 };
      e.revenue += i.amount;
      map.set(i.invoice_date, e);
    });
    inRange.exp.forEach((x) => {
      const e = map.get(x.expense_date) ?? { date: x.expense_date, revenue: 0, expenses: 0 };
      e.expenses += x.amount;
      map.set(x.expense_date, e);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, label: format(parseISO(d.date), "MMM d") }));
  }, [inRange]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Revenue, expenses, profit and margin for any date range.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rfrom">From</Label>
              <Input
                id="rfrom"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rto">To</Label>
              <Input id="rto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Revenue" value={currency(totals.revenue)} />
        <SummaryCard label="Expenses" value={currency(totals.exp)} />
        <SummaryCard
          label="Profit"
          value={currency(totals.profit)}
          tone={totals.profit >= 0 ? "success" : "destructive"}
        />
        <SummaryCard
          label="Margin"
          value={totals.revenue > 0 ? `${totals.margin.toFixed(1)}%` : "—"}
          tone={totals.profit >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Paid invoices</div>
            <div className="mt-1 text-xl font-bold text-success">{currency(totals.paid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Unpaid invoices</div>
            <div className="mt-1 text-xl font-bold text-warning">{currency(totals.unpaid)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily revenue vs expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {daily.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data in this range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
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
                  <Bar dataKey="revenue" name="Revenue" fill="var(--color-primary)" radius={4} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--color-warning)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses by category</CardTitle>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses in this range
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
                      {pct.toFixed(1)}% of expenses
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
            "mt-1 text-2xl font-bold " +
            (tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
