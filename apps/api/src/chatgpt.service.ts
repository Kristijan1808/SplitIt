import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const BillResponse = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      price: z.number().nonnegative()
    })
  )
});

export type ParsedBillItem = z.infer<typeof BillResponse>["items"][number];

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
                "Return the item name and the final price shown for that item.",
                "Do not include subtotal, tax, VAT, service charge, tip, discount totals, grand total, payment, or other summary rows as items.",
                "If the same product appears on multiple separate lines, keep the separate lines.",
                "Use the numeric price exactly as shown on the bill when it can be read.",
                "Do not invent items or prices. If a line cannot be identified reliably, omit it.",

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

    return response.output_parsed.items.map((item) => ({
      name: item.name.trim(),
      price: Number(item.price)
    }));
  };
}

export const chatGptService = new ChatGptService();
