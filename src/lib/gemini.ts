export type ExtractKind = "revenue" | "expense";

const expensePrompt = `You are analyzing a photograph of a receipt or expense document for a Portuguese butcher shop.
Extract the following fields and return ONLY valid JSON (no markdown, no code fences):
{
  "expense_date": "YYYY-MM-DD format. Convert DD/MM/YYYY if needed. Empty string if unsure.",
  "amount": 0.00,
  "category": "one of: meat_purchases, supplies, utilities, wages, rent, other",
  "notes": "Brief note: supplier/vendor name and 1-3 word description. Empty string if none."
}

Category guide:
- meat_purchases: meat/livestock suppliers
- supplies: packaging, cleaning, equipment
- utilities: water, electricity, gas
- wages: payroll, salaries
- rent: shop or office rent
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

export type ExtractMode = "total" | "items";

export async function extractDocumentWithGemini(dataUrl: string, kind: ExtractKind, mode: ExtractMode = "total") {
  let apiKey = localStorage.getItem("GEMINI_API_KEY");

  if (!apiKey) {
    apiKey = window.prompt(
      "Enter your Gemini API Key to enable document scanning (it will be saved for future use):"
    );
    if (!apiKey) throw new Error("Gemini API Key is required to scan documents.");
    localStorage.setItem("GEMINI_API_KEY", apiKey.trim());
    apiKey = apiKey.trim();
  }

  let prompt = kind === "expense" ? expensePrompt : revenuePrompt;

  if (mode === "items") {
    prompt += `\n\nCRITICAL INSTRUCTION FOR ITEMS MODE: 
The user wants you to calculate the total from individual line items (e.g. "pork belly 3kg at 5.00/kg").
1. Identify all items, their weights (or quantities), and price per unit/kg.
2. Calculate the cost for each item (weight x price).
3. Sum all the individual costs to get the grand total. 
4. Return this calculated grand total as the "amount".
5. In the "notes" field, write a clear breakdown of the items, e.g. "Pork: 3kg @ 5.00 = 15.00 | Lamb: 5kg @ 2.00 = 10.00".`;
  }

  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image format. Expected data URL.");
  }
  const mimeType = match[1];
  const base64Data = match[2];

  // Use gemini-2.5-flash
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt + "\\n\\nToday's date: " + new Date().toISOString().slice(0, 10) },
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

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Gemini API Error:", res.status, errorBody);
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      if (res.status === 400 && errorBody.includes("API key not valid")) {
        localStorage.removeItem("GEMINI_API_KEY");
        throw new Error("Invalid Gemini API Key. Please refresh and try again.");
      }
      throw new Error(`API Error (${res.status}): ${errorBody.slice(0, 150)}...`);
    }
    throw new Error(`AI extraction failed (${res.status}): ${errorBody.slice(0, 150)}...`);
  }

  const data = await res.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("No response from AI");
  }

  try {
    const cleaned = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Invalid AI response format");
  }
}
