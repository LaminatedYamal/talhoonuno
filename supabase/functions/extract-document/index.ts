// Edge function: extract structured data from a photographed document
// (invoice/revenue or expense receipt) using Lovable AI vision.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ExtractKind = "revenue" | "expense";

const expenseSchema = {
  type: "object",
  properties: {
    expense_date: {
      type: "string",
      description:
        "Document date in ISO format YYYY-MM-DD. If only DD/MM/YYYY visible, convert. If unsure, leave empty.",
    },
    amount: {
      type: "number",
      description:
        "Total amount due/paid as a number. Use the grand total, not subtotal. Use dot as decimal separator.",
    },
    category: {
      type: "string",
      enum: ["meat_purchases", "supplies", "utilities", "wages", "other"],
      description:
        "Best-guess category. meat_purchases for meat/livestock suppliers, supplies for packaging/cleaning, utilities for water/electricity/gas, wages for payroll.",
    },
    notes: {
      type: "string",
      description:
        "Brief note: supplier/vendor name and 1-3 word description. Empty string if none.",
    },
  },
  required: ["expense_date", "amount", "category", "notes"],
  additionalProperties: false,
};

const revenueSchema = {
  type: "object",
  properties: {
    invoice_date: {
      type: "string",
      description:
        "Document/sale date in ISO format YYYY-MM-DD. If only DD/MM/YYYY visible, convert. If unsure, leave empty.",
    },
    amount: {
      type: "number",
      description:
        "Total amount as a number. Use the grand total. Use dot as decimal separator.",
    },
    customer_name: {
      type: "string",
      description:
        "Customer / client name shown on the invoice. Empty string if not visible.",
    },
    paid: {
      type: "boolean",
      description:
        "True if the document is clearly marked paid/quitação/pago, otherwise false.",
    },
    notes: {
      type: "string",
      description: "Brief note (e.g., invoice number). Empty string if none.",
    },
  },
  required: ["invoice_date", "amount", "customer_name", "paid", "notes"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as { image: string; kind: ExtractKind };
    if (!body?.image || !body?.kind) {
      return new Response(JSON.stringify({ error: "image and kind are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isExpense = body.kind === "expense";
    const toolName = isExpense ? "extract_expense" : "extract_revenue";
    const schema = isExpense ? expenseSchema : revenueSchema;

    const systemPrompt =
      "You extract structured financial data from photographed Portuguese (PT-PT) and English receipts/invoices for a butcher shop. " +
      "Always return values via the provided tool. If a field is unclear, leave it empty (string) or 0 (number). " +
      "Today's date for relative reasoning: " +
      new Date().toISOString().slice(0, 10);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: isExpense
                  ? "Extract the expense from this receipt photo."
                  : "Extract the revenue/invoice from this document photo.",
              },
              { type: "image_url", image_url: { url: body.image } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: toolName,
              description: isExpense
                ? "Return extracted expense fields."
                : "Return extracted revenue/invoice fields.",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de pedidos excedido / Rate limit. Tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Sem créditos AI / Out of AI credits. Adicione créditos em Settings.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured output returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Tool args parse error", e);
      return new Response(JSON.stringify({ error: "Invalid AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-document error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
