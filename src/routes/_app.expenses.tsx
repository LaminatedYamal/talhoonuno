import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { pt as ptLocale, enUS as enLocale } from "date-fns/locale";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useExpenses, type Expense } from "@/lib/data-hooks";
import { expenseCategories, type ExpenseCategory } from "@/lib/format";
import { ExpenseDialog } from "@/components/ExpenseDialog";
import { useCurrency, useI18n } from "@/i18n/I18nProvider";
import { datePresets, type PresetKey } from "@/lib/date-presets";

export const Route = createFileRoute("/_app/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const { t, lang } = useI18n();
  const currency = useCurrency();
  const dLocale = lang === "pt" ? ptLocale : enLocale;
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cat, setCat] = useState<ExpenseCategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const range = useMemo(() => {
    if (preset === "custom") return { from, to };
    return datePresets[preset]();
  }, [preset, from, to]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(t.expenses.deletedToast);
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.somethingWrong),
  });

  const filtered = useMemo(() => {
    let rows = expenses ?? [];
    if (cat !== "all") rows = rows.filter((r) => r.category === cat);
    if (range.from) rows = rows.filter((r) => r.expense_date >= range.from);
    if (range.to) rows = rows.filter((r) => r.expense_date <= range.to);
    return rows;
  }, [expenses, cat, range]);

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    filtered.forEach((e) => {
      const arr = map.get(e.expense_date) ?? [];
      arr.push(e);
      map.set(e.expense_date, arr);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const total = filtered.reduce((a, e) => a + e.amount, 0);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.expenses.title}</h1>
          <p className="text-sm text-muted-foreground">{t.expenses.subtitle}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {t.expenses.newExpense}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">{t.common.total}</div>
            <div className="mt-1 text-xl font-bold">{currency(total)}</div>
          </CardContent>
        </Card>
        {byCat.slice(0, 3).map(([c, v]) => (
          <Card key={c}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">
                {t.expenseCat[c as ExpenseCategory]}
              </div>
              <div className="mt-1 text-xl font-bold">{currency(v)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">{t.common.category}</Label>
              <Select value={cat} onValueChange={(v) => setCat(v as ExpenseCategory | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.expenses.allCategories}</SelectItem>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t.expenseCat[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:w-[180px]">
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
                  <SelectItem value="all">{t.expenses.allCategories}</SelectItem>
                  <SelectItem value="custom">{t.reports.custom}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              variant="outline" 
              className="md:hidden" 
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              Filtros Avançados
            </Button>

            <div className={`flex flex-col gap-3 md:flex-row ${showAdvanced ? "flex" : "hidden md:flex"}`}>
              <div className="space-y-1 md:w-[150px]">
                <Label className="text-xs">{t.common.from}</Label>
                <Input
                  type="date"
                  value={preset === "custom" ? from : range.from}
                  disabled={preset !== "custom"}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:w-[150px]">
                <Label className="text-xs">{t.common.to}</Label>
                <Input
                  type="date"
                  value={preset === "custom" ? to : range.to}
                  disabled={preset !== "custom"}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="space-y-1 md:w-[80px]">
                <Label className="text-xs">{t.common.count}</Label>
                <div className="flex h-12 md:h-12 items-center justify-center rounded-md border bg-muted/40 px-3 text-sm font-semibold">
                  {filtered.length}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t.common.loading}
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <div className="font-medium">{t.expenses.none}</div>
            <p className="max-w-sm text-sm text-muted-foreground">{t.expenses.noneTip}</p>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> {t.expenses.addExpense}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => {
            const dayTotal = items.reduce((a, e) => a + e.amount, 0);
            return (
              <Card key={date}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
                    <div className="font-semibold">
                      {format(parseISO(date), "EEEE, d MMM yyyy", { locale: dLocale })}
                    </div>
                    <div className="text-sm font-bold">{currency(dayTotal)}</div>
                  </div>
                  <ul className="divide-y">
                    {items.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-4 hover:bg-accent/40"
                      >
                        <div className="flex justify-between items-center w-full md:w-auto">
                          <Badge variant="secondary" className="shrink-0">
                            {t.expenseCat[e.category]}
                          </Badge>
                          <div className="font-bold text-lg md:hidden">{currency(e.amount)}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          {e.notes ? (
                            <div className="text-sm bg-muted/30 p-2 rounded md:bg-transparent md:p-0 md:truncate">{e.notes}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground">{t.expenses.noNotes}</div>
                          )}
                        </div>
                        <div className="hidden md:block font-semibold">{currency(e.amount)}</div>
                        <div className="flex justify-end gap-1 mt-2 md:mt-0 border-t md:border-t-0 pt-2 md:pt-0">
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setEditing(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(e.id)}
                            className="h-10 w-10 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ExpenseDialog open={adding} onOpenChange={setAdding} />
      <ExpenseDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        expense={editing}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.expenses.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.expenses.deleteDescription}</AlertDialogDescription>
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
