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
import type { Invoice } from "@/lib/data-hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { fileToDataUrl } from "@/lib/image";
import { extractDocumentWithGemini, type ExtractMode } from "@/lib/gemini";

const schema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  invoice_date: z.string().min(1),
  amount: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice?: Invoice | null;
}

export function InvoiceDialog({ open, onOpenChange, invoice }: Props) {
  const editing = !!invoice;
  const { t } = useI18n();
  const qc = useQueryClient();
  const [customer, setCustomer] = useState(invoice?.customer_name ?? "");
  const [date, setDate] = useState(
    invoice?.invoice_date ?? new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState<string>(invoice ? String(invoice.amount) : "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [extracting, setExtracting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const modeRef = useRef<ExtractMode>("total");

  const key = `${invoice?.id ?? "new"}-${open}`;

  const handlePhotoClick = (mode: ExtractMode) => {
    modeRef.current = mode;
    fileInput.current?.click();
  };

  const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await extractDocumentWithGemini(dataUrl, "revenue", modeRef.current);
      const r = result as
        | {
            invoice_date?: string;
            amount?: number;
            customer_name?: string;
            notes?: string;
          }
        | undefined;
      if (!r) throw new Error("No data");
      if (r.invoice_date) setDate(r.invoice_date);
      if (typeof r.amount === "number" && r.amount > 0) setAmount(String(r.amount));
      if (r.customer_name) setCustomer(r.customer_name);
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
        customer_name: values.customer_name,
        invoice_date: values.invoice_date,
        amount: values.amount,
        paid: true,
        notes: values.notes || null,
      };
      if (editing && invoice) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", invoice.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("invoices")
          .insert({ ...payload, created_by: userData.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(editing ? t.revenue.updatedToast : t.revenue.savedToast);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.somethingWrong),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      customer_name: customer,
      invoice_date: date,
      amount,
      notes,
    });
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
          <DialogTitle>{editing ? t.revenue.editRevenue : t.revenue.newRevenue}</DialogTitle>
          <DialogDescription>
            {editing ? t.revenue.editDescription : t.revenue.newDescription}
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
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full border-primary/30"
                onClick={() => handlePhotoClick("total")}
                disabled={extracting}
              >
                {extracting && modeRef.current === "total" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.common.extracting}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    <Sparkles className="h-3 w-3 text-gold" />
                    Ler Total (Normal)
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-primary/30"
                onClick={() => handlePhotoClick("items")}
                disabled={extracting}
              >
                {extracting && modeRef.current === "items" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.common.extracting}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    <Sparkles className="h-3 w-3 text-gold" />
                    Calcular Produtos (Peso x Preço)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">{t.common.customer}</Label>
            <Input
              id="customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder={t.revenue.customerPlaceholder}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">{t.common.date}</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">{t.common.amount}</Label>
              <Input
                id="amount"
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
            <Label htmlFor="notes">{t.common.notesOptional}</Label>
            <Textarea
              id="notes"
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
              {editing ? t.common.saveChanges : t.revenue.addRevenue}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
