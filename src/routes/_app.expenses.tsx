import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { currency, expenseCategories, expenseCategoryLabel, type ExpenseCategory } from "@/lib/format";
import { ExpenseDialog } from "@/components/ExpenseDialog";

export const Route = createFileRoute("/_app/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cat, setCat] = useState<ExpenseCategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = useMemo(() => {
    let rows = expenses ?? [];
    if (cat !== "all") rows = rows.filter((r) => r.category === cat);
    if (from) rows = rows.filter((r) => r.expense_date >= from);
    if (to) rows = rows.filter((r) => r.expense_date <= to);
    return rows;
  }, [expenses, cat, from, to]);

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
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Daily costs grouped by date with category totals.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> New expense
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Total</div>
            <div className="mt-1 text-xl font-bold">{currency(total)}</div>
          </CardContent>
        </Card>
        {byCat.slice(0, 3).map(([c, v]) => (
          <Card key={c}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">
                {expenseCategoryLabel(c)}
              </div>
              <div className="mt-1 text-xl font-bold">{currency(v)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={cat} onValueChange={(v) => setCat(v as ExpenseCategory | "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {expenseCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {expenseCategoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <div className="font-medium">No expenses recorded</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Track meat purchases, supplies, utilities and wages to calculate true profit.
            </p>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add expense
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
                      {format(parseISO(date), "EEEE, MMM d, yyyy")}
                    </div>
                    <div className="text-sm font-bold">{currency(dayTotal)}</div>
                  </div>
                  <ul className="divide-y">
                    {items.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                      >
                        <Badge variant="secondary" className="shrink-0">
                          {expenseCategoryLabel(e.category)}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          {e.notes ? (
                            <div className="truncate text-sm">{e.notes}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No notes</div>
                          )}
                        </div>
                        <div className="font-semibold">{currency(e.amount)}</div>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(e.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && remove.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
