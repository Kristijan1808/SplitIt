import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { BillResponse, validateScannedBill, type ParsedBillItem } from "./services/bill-scan.js";
export type { ParsedBillItem } from "./services/bill-scan.js";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export class ChatGptService {
  private client: OpenAI | null = null;

  private getClient = (): OpenAI => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 60_000,
        maxRetries: 2
      });
    }

    return this.client;
  };

  extractBillItems = async (
    image: Buffer,
    mimeType: string,
    attempt = 1
  ): Promise<ParsedBillItem[]> => {
    if (!image.length) {
      throw new Error("The uploaded image is empty");
    }

    if (image.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("The uploaded image is too large. Maximum size is 10 MB");
    }

    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      throw new Error(
        "Unsupported image type. Please upload a JPEG, PNG, WebP, or GIF image"
      );
    }

    const imageDataUrl = `data:${mimeType};base64,${image.toString("base64")}`;
    const model = attempt === 2 ? "gpt-5.5" : "gpt-5-mini";

    const response = await this.getClient().responses.parse({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Read this restaurant/store bill and extract every purchasable line item.",
                "Read the column headings first: Cijena/Price is UNIT price, Kol./Qty is QUANTITY, Ukupno/Amount is LINE TOTAL. Columns may be in a different order.",
                "Return each item with name, quantity, unitPrice and lineTotal separately. Read printed values independently; do not replace a printed quantity with 1 or a unit price with the line total.",
                "Example: NESCAFE | Cijena 2,50 | Kol. 2,00 | Ukupno 5,00 means quantity=2, unitPrice=2.50, lineTotal=5.00. Decimal commas are decimal separators.",
                "If quantity is not printed and the line clearly represents one item, use quantity=1. If a value is unreadable or uncertain, return null for that value rather than guessing.",
                "Return receiptTotal from the printed grand total (Ukupno), not cash tendered or change. Use null if it is not readable.",
                "Check every line: quantity * unitPrice should equal lineTotal. Check all line totals against receiptTotal. Re-read the image if they disagree; never change printed values merely to make totals match.",
                "Do not include subtotal, tax, VAT, service charge, tip, discount totals, grand total, payment, or other summary rows as items.",
                "If the same product appears on multiple separate lines, keep the separate lines.",
                "Use the numeric price exactly as shown on the bill when it can be read.",
                "Do not invent or silently omit purchase rows. If any purchase row is unreadable, set hasUnreadableItems=true; otherwise false.",

                "IMPORTANT: Always return item names using Latin script.",
                "If an item name is written in a non-Latin script such as Japanese, Chinese, Korean, Arabic, Hebrew, Greek, Cyrillic, or another non-Latin writing system, do not return the original script.",
                "Instead, transliterate the name into Latin characters or, when appropriate and reliably identifiable, translate it into English.",
                "If the item name is in a language other than English and its English meaning can be reliably determined, return the English name.",
                "For Japanese, Chinese, Korean, and other non-Latin receipts, prefer a natural English product name when it can be determined reliably.",
                "Never return an item name containing non-Latin characters."
              ].join(" ")
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high"
            }
          ]
        }
      ],
      text: {
        format: zodTextFormat(BillResponse, "bill_items")
      }
    });

    if (!response.output_parsed) {
      throw new Error("ChatGPT did not return bill items");
    }

    return validateScannedBill(response.output_parsed);
  };
}

export const chatGptService = new ChatGptService();
