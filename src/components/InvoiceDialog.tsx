import { useState, type FormEvent } from "react";
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
import { Loader2 } from "lucide-react";
import type { Invoice } from "@/lib/data-hooks";

const schema = z.object({
  customer_name: z.string().trim().min(1, "Customer name is required").max(120),
  invoice_date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().min(0, "Amount must be ≥ 0").max(1_000_000),
  paid: z.enum(["paid", "unpaid"]),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice?: Invoice | null;
}

export function InvoiceDialog({ open, onOpenChange, invoice }: Props) {
  const editing = !!invoice;
  const qc = useQueryClient();
  const [customer, setCustomer] = useState(invoice?.customer_name ?? "");
  const [date, setDate] = useState(
    invoice?.invoice_date ?? new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState<string>(invoice ? String(invoice.amount) : "");
  const [paid, setPaid] = useState<"paid" | "unpaid">(invoice?.paid ? "paid" : "unpaid");
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  // Reset form when dialog reopens with different invoice
  const key = `${invoice?.id ?? "new"}-${open}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // We use 'key' indirectly: state initialized once per mount; consumers re-mount via key prop below.

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = {
        customer_name: values.customer_name,
        invoice_date: values.invoice_date,
        amount: values.amount,
        paid: values.paid === "paid",
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
      toast.success(editing ? "Invoice updated" : "Invoice added");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      customer_name: customer,
      invoice_date: date,
      amount,
      paid,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={key}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update invoice details." : "Record a new invoice for a customer."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Input
              id="customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="e.g. Maria's Restaurant"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
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
            <Label>Status</Label>
            <Select value={paid} onValueChange={(v) => setPaid(v as "paid" | "unpaid")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
