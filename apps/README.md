# SplitIt

This version includes bill-image parsing with OpenAI.

## Bill image flow

1. `GroupAddExpensePage` lets the user select a bill image.
2. React sends the image as `multipart/form-data` to `POST /ai/parse-bill`.
3. The API receives the image in memory and passes it to `ChatGptService`.
4. `ChatGptService` sends the image to the OpenAI Responses API with structured JSON output.
5. The API returns `{ items: [{ name, price }] }`.
6. React replaces the current draft item rows with the recognized bill items, leaving their participant assignments empty so they can be assigned manually.

The OpenAI API key is never sent to the browser.

## Configuration

In `api/.env` set:

```env
OPENAI_API_KEY="your-openai-api-key"
OPENAI_BILL_MODEL="gpt-5.5"
```

The uploaded image is limited to 10 MB and accepted formats are JPEG, PNG, WebP, and GIF.

## Install

API:

```bash
cd api
npm install
npm run build
npm run dev
```

Web:

```bash
cd web
npm install
npm run dev
```
