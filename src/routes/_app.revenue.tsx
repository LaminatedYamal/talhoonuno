import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { pt as ptLocale, enUS as enLocale } from "date-fns/locale";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useInvoices, type Invoice } from "@/lib/data-hooks";
import { useCurrency, useI18n } from "@/i18n/I18nProvider";
import { InvoiceDialog } from "@/components/InvoiceDialog";
import { datePresets, type PresetKey } from "@/lib/date-presets";

export const Route = createFileRoute("/_app/revenue")({
  component: RevenuePage,
});

type StatusFilter = "all" | "paid" | "unpaid";
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

function RevenuePage() {
  const { data: invoices, isLoading } = useInvoices();
  const { t, lang } = useI18n();
  const currency = useCurrency();
  const dLocale = lang === "pt" ? ptLocale : enLocale;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const range = useMemo(() => {
    if (preset === "custom") return { from, to };
    return datePresets[preset]();
  }, [preset, from, to]);

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("invoices").update({ paid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.somethingWrong),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t.revenue.deletedToast);
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.somethingWrong),
  });

  const filtered = useMemo(() => {
    let rows = invoices ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.customer_name.toLowerCase().includes(q));
    }
    if (status !== "all") rows = rows.filter((r) => (status === "paid" ? r.paid : !r.paid));
    if (range.from) rows = rows.filter((r) => r.invoice_date >= range.from);
    if (range.to) rows = rows.filter((r) => r.invoice_date <= range.to);
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return a.invoice_date.localeCompare(b.invoice_date);
        case "amount_desc":
          return b.amount - a.amount;
        case "amount_asc":
          return a.amount - b.amount;
        default:
          return b.invoice_date.localeCompare(a.invoice_date);
      }
    });
    return rows;
  }, [invoices, search, status, range, sort]);

  const total = filtered.reduce((a, r) => a + r.amount, 0);
  const unpaid = filtered.filter((r) => !r.paid).reduce((a, r) => a + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.revenue.title}</h1>
          <p className="text-sm text-muted-foreground">{t.revenue.subtitle}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {t.revenue.newRevenue}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SmallStat label={t.common.total} value={currency(total)} />
        <SmallStat label={t.dashboard.outstanding} value={currency(unpaid)} tone="warning" />
        <SmallStat label={t.common.count} value={String(filtered.length)} />
        <SmallStat
          label={t.revenue.paid}
          value={String(filtered.filter((r) => r.paid).length)}
          tone="success"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">{t.common.search}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t.common.search}
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.common.status}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.revenue.allStatuses}</SelectItem>
                  <SelectItem value="paid">{t.revenue.paid}</SelectItem>
                  <SelectItem value="unpaid">{t.revenue.unpaid}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  <SelectItem value="all">{t.revenue.allStatuses}</SelectItem>
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
          </div>
          <div className="mt-3 flex justify-end">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">{t.revenue.sortDateDesc}</SelectItem>
                <SelectItem value="date_asc">{t.revenue.sortDateAsc}</SelectItem>
                <SelectItem value="amount_desc">{t.revenue.sortAmountDesc}</SelectItem>
                <SelectItem value="amount_asc">{t.revenue.sortAmountAsc}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t.common.loading}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground" />
              <div className="font-medium">{t.revenue.noMatch}</div>
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> {t.revenue.addRevenue}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.customer}</TableHead>
                  <TableHead>{t.common.date}</TableHead>
                  <TableHead className="text-right">{t.common.amount}</TableHead>
                  <TableHead className="text-center">{t.revenue.paid}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="font-medium">{inv.customer_name}</div>
                      {inv.notes && (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {inv.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(inv.invoice_date), "PP", { locale: dLocale })}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currency(inv.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-2">
                        <Switch
                          checked={inv.paid}
                          onCheckedChange={(v) => togglePaid.mutate({ id: inv.id, paid: v })}
                        />
                        <Badge
                          variant="outline"
                          className={
                            inv.paid
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-warning/30 bg-warning/10 text-warning"
                          }
                        >
                          {inv.paid ? t.revenue.paid : t.revenue.unpaid}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(inv)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(inv.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InvoiceDialog open={adding} onOpenChange={setAdding} />
      <InvoiceDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        invoice={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.revenue.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.revenue.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && remove.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div
          className={
            "mt-1 text-xl font-bold " +
            (tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
