import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Plus, Receipt, Wallet, TrendingUp, AlertCircle, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useInvoices,
  useExpenses,
  useDateRanges,
  sumInRange,
  trendLast30Days,
} from "@/lib/data-hooks";
import { useCurrency, useI18n } from "@/i18n/I18nProvider";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { ExpenseDialog } from "@/components/ExpenseDialog";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: invoices, isLoading: li } = useInvoices();
  const { data: expenses, isLoading: le } = useExpenses();
  const r = useDateRanges();
  const { t } = useI18n();
  const currency = useCurrency();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const stats = useMemo(() => {
    const revToday = sumInRange(invoices, (i) => i.invoice_date, r.todayStart, r.todayEnd);
    const revWeek = sumInRange(invoices, (i) => i.invoice_date, r.weekStart, r.weekEnd);
    const revMonth = sumInRange(invoices, (i) => i.invoice_date, r.monthStart, r.monthEnd);
    const expToday = sumInRange(expenses, (e) => e.expense_date, r.todayStart, r.todayEnd);
    const expWeek = sumInRange(expenses, (e) => e.expense_date, r.weekStart, r.weekEnd);
    const expMonth = sumInRange(expenses, (e) => e.expense_date, r.monthStart, r.monthEnd);
    const outstanding = (invoices ?? []).filter((i) => !i.paid).reduce((a, i) => a + i.amount, 0);
    const paidCount = (invoices ?? []).filter((i) => i.paid).length;
    const unpaidCount = (invoices ?? []).filter((i) => !i.paid).length;
    return {
      revToday,
      revWeek,
      revMonth,
      profitToday: revToday - expToday,
      profitWeek: revWeek - expWeek,
      profitMonth: revMonth - expMonth,
      outstanding,
      paidCount,
      unpaidCount,
    };
  }, [invoices, expenses, r]);

  const trend = useMemo(() => trendLast30Days(invoices, expenses), [invoices, expenses]);
  const paidPie = [
    { name: t.revenue.paid, value: stats.paidCount },
    { name: t.revenue.unpaid, value: stats.unpaidCount },
  ];

  const loading = li || le;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setExpenseOpen(true)}>
            <Plus className="h-4 w-4" /> {t.dashboard.newExpense}
          </Button>
          <Button onClick={() => setInvoiceOpen(true)}>
            <Plus className="h-4 w-4" /> {t.dashboard.newRevenue}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t.dashboard.revenueToday}
          value={currency(stats.revToday)}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
        />
        <KpiCard
          title={t.dashboard.revenueWeek}
          value={currency(stats.revWeek)}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
        <KpiCard
          title={t.dashboard.revenueMonth}
          value={currency(stats.revMonth)}
          icon={<Receipt className="h-4 w-4" />}
          loading={loading}
        />
        <KpiCard
          title={t.dashboard.outstanding}
          value={currency(stats.outstanding)}
          icon={<AlertCircle className="h-4 w-4" />}
          tone="warning"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <ProfitCard label={t.dashboard.profitToday} value={currency(stats.profitToday)} positive={stats.profitToday >= 0} loading={loading} />
        <ProfitCard label={t.dashboard.profitWeek} value={currency(stats.profitWeek)} positive={stats.profitWeek >= 0} loading={loading} />
        <ProfitCard label={t.dashboard.profitMonth} value={currency(stats.profitMonth)} positive={stats.profitMonth >= 0} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.dashboard.trend}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.paidVsUnpaid}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {stats.paidCount + stats.unpaidCount === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paidPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      <Cell fill="var(--color-success)" />
                      <Cell fill="var(--color-gold)" />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {(invoices?.length ?? 0) === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t.dashboard.noInvoices}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t.dashboard.addFirst}</p>
            <div className="flex gap-2">
              <Button onClick={() => setInvoiceOpen(true)}>
                <Plus className="h-4 w-4" /> {t.dashboard.addRevenue}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/revenue">{t.dashboard.viewRevenue}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <InvoiceDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} />
      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  tone,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone?: "warning";
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
          <span className={tone === "warning" ? "text-warning" : "text-primary"}>{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <div className={"mt-1 text-2xl font-bold " + (tone === "warning" ? "text-warning" : "")}>
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfitCard({
  label,
  value,
  positive,
  loading,
}: {
  label: string;
  value: string;
  positive: boolean;
  loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-32" />
        ) : (
          <div
            className={
              "mt-1 text-2xl font-bold " + (positive ? "text-success" : "text-destructive")
            }
          >
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      —
    </div>
  );
}
