// Edge function: extract structured data from a photographed document
// (invoice/revenue or expense receipt) using Google Gemini API directly.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ExtractKind = "revenue" | "expense";

const expensePrompt = `You are analyzing a photograph of a receipt or expense document for a Portuguese butcher shop.
Extract the following fields and return ONLY valid JSON (no markdown, no code fences):
{
  "expense_date": "YYYY-MM-DD format. Convert DD/MM/YYYY if needed. Empty string if unsure.",
  "amount": 0.00,
  "category": "one of: meat_purchases, supplies, utilities, wages, other",
  "notes": "Brief note: supplier/vendor name and 1-3 word description. Empty string if none."
}

Category guide:
- meat_purchases: meat/livestock suppliers
- supplies: packaging, cleaning, equipment
- utilities: water, electricity, gas, rent
- wages: payroll, salaries
- other: anything else

Use dot as decimal separator. Use the grand total, not subtotal.`;

const revenuePrompt = `You are analyzing a photograph of an invoice or revenue document for a Portuguese butcher shop.
Extract the following fields and return ONLY valid JSON (no markdown, no code fences):
{
  "invoice_date": "YYYY-MM-DD format. Convert DD/MM/YYYY if needed. Empty string if unsure.",
  "amount": 0.00,
  "customer_name": "Customer/client name on the invoice. Empty string if not visible.",
  "paid": false,
  "notes": "Brief note (e.g. invoice number). Empty string if none."
}

Set paid to true only if the document is clearly marked paid/quitação/pago, otherwise false.
Use dot as decimal separator. Use the grand total.`;

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

    // Try GEMINI_API_KEY first, fall back to LOVABLE_API_KEY for backwards compat
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (GEMINI_API_KEY) {
      // ── Use Google Gemini API directly ──
      return await handleGemini(GEMINI_API_KEY, body.image, body.kind);
    } else if (LOVABLE_API_KEY) {
      // ── Fallback: use Lovable AI gateway (original behavior) ──
      return await handleLovable(LOVABLE_API_KEY, body.image, body.kind);
    } else {
      return new Response(
        JSON.stringify({ error: "No API key configured. Set GEMINI_API_KEY in Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    console.error("extract-document error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Gemini API handler ──
async function handleGemini(apiKey: string, imageDataUrl: string, kind: ExtractKind) {
  const isExpense = kind === "expense";
  const prompt = isExpense ? expensePrompt : revenuePrompt;

  // Extract base64 data and mime type from data URL
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    return new Response(JSON.stringify({ error: "Invalid image format. Expected data URL." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const mimeType = match[1];
  const base64Data = match[2];

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt + "\n\nToday's date: " + new Date().toISOString().slice(0, 10) },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error("Gemini API error", geminiRes.status, errText);

    if (geminiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de pedidos excedido / Rate limit. Tente novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (geminiRes.status === 403 || geminiRes.status === 401) {
      return new Response(
        JSON.stringify({ error: "Chave API inválida / Invalid API key. Check GEMINI_API_KEY." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: "AI extraction failed: " + geminiRes.status }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await geminiRes.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    return new Response(JSON.stringify({ error: "No response from AI" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsed: Record<string, unknown> = {};
  try {
    // Clean up potential markdown code fences
    const cleaned = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse error", e, textContent);
    return new Response(JSON.stringify({ error: "Invalid AI response format" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ result: parsed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Lovable AI gateway handler (original, kept as fallback) ──
async function handleLovable(apiKey: string, imageDataUrl: string, kind: ExtractKind) {
  const isExpense = kind === "expense";
  const toolName = isExpense ? "extract_expense" : "extract_revenue";

  const expenseSchema = {
    type: "object",
    properties: {
      expense_date: { type: "string", description: "Document date in ISO format YYYY-MM-DD." },
      amount: { type: "number", description: "Total amount as a number." },
      category: {
        type: "string",
        enum: ["meat_purchases", "supplies", "utilities", "wages", "other"],
      },
      notes: { type: "string", description: "Brief note." },
    },
    required: ["expense_date", "amount", "category", "notes"],
    additionalProperties: false,
  };

  const revenueSchema = {
    type: "object",
    properties: {
      invoice_date: { type: "string", description: "Document date in ISO format YYYY-MM-DD." },
      amount: { type: "number", description: "Total amount as a number." },
      customer_name: { type: "string", description: "Customer name." },
      paid: { type: "boolean", description: "True if marked paid." },
      notes: { type: "string", description: "Brief note." },
    },
    required: ["invoice_date", "amount", "customer_name", "paid", "notes"],
    additionalProperties: false,
  };

  const schema = isExpense ? expenseSchema : revenueSchema;
  const systemPrompt =
    "You extract structured financial data from photographed Portuguese (PT-PT) and English receipts/invoices for a butcher shop. " +
    "Always return values via the provided tool. If a field is unclear, leave it empty (string) or 0 (number). " +
    "Today's date for relative reasoning: " +
    new Date().toISOString().slice(0, 10);

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
            { type: "image_url", image_url: { url: imageDataUrl } },
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
}
