import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Camera, Sparkles } from "lucide-react";
import { expenseCategories, type ExpenseCategory } from "@/lib/format";
import type { Expense } from "@/lib/data-hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { fileToDataUrl } from "@/lib/image";

const schema = z.object({
  expense_date: z.string().min(1),
  category: z.enum(expenseCategories),
  amount: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense?: Expense | null;
}

export function ExpenseDialog({ open, onOpenChange, expense }: Props) {
  const editing = !!expense;
  const { t } = useI18n();
  const qc = useQueryClient();
  const [date, setDate] = useState(
    expense?.expense_date ?? new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    (expense?.category as ExpenseCategory) ?? "meat_purchases",
  );
  const [amount, setAmount] = useState<string>(expense ? String(expense.amount) : "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [extracting, setExtracting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const key = `${expense?.id ?? "new"}-${open}`;

  const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { image: dataUrl, kind: "expense" },
      });
      if (error) throw error;
      const r = data?.result as
        | { expense_date?: string; amount?: number; category?: ExpenseCategory; notes?: string }
        | undefined;
      if (!r) throw new Error("No data");
      if (r.expense_date) setDate(r.expense_date);
      if (typeof r.amount === "number" && r.amount > 0) setAmount(String(r.amount));
      if (r.category && expenseCategories.includes(r.category)) setCategory(r.category);
      if (r.notes) setNotes(r.notes);
      toast.success(t.common.extractedOk);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.extractFailed);
    } finally {
      setExtracting(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = {
        expense_date: values.expense_date,
        category: values.category,
        amount: values.amount,
        notes: values.notes || null,
      };
      if (editing && expense) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", expense.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("expenses")
          .insert({ ...payload, created_by: userData.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(editing ? t.expenses.updatedToast : t.expenses.savedToast);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.somethingWrong),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ expense_date: date, category, amount, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t.common.somethingWrong);
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={key}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t.expenses.editExpense : t.expenses.newExpense}</DialogTitle>
          <DialogDescription>
            {editing ? t.expenses.editDescription : t.expenses.newDescription}
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full border-primary/30"
              onClick={() => fileInput.current?.click()}
              disabled={extracting}
            >
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.common.extracting}
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  <Sparkles className="h-3 w-3 text-gold" />
                  {t.common.photo}
                </>
              )}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edate">{t.common.date}</Label>
              <Input
                id="edate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eamount">{t.common.amount}</Label>
              <Input
                id="eamount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.common.category}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t.expenseCat[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="enotes">{t.common.notesOptional}</Label>
            <Textarea
              id="enotes"
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? t.common.saveChanges : t.expenses.addExpense}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
