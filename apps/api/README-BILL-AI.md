# Bill image AI integration

The API now exposes `POST /ai/parse-bill`.

## Request

Send a `multipart/form-data` request with a single field named `file` containing a JPEG, PNG, WebP, or GIF image. Maximum size is 10 MB.

## Response

```json
{
  "items": [
    { "name": "Pizza Margherita", "price": 12.5 },
    { "name": "Coca Cola", "price": 3.2 }
  ]
}
```

The backend keeps the OpenAI API key private. The React app uploads the image to the SplitIt API; only the backend communicates with OpenAI.

## Configuration

Add these values to `apps/api/.env`:

```env
OPENAI_API_KEY="your-openai-api-key"
OPENAI_BILL_MODEL="gpt-5.5"
```

The model can be changed without modifying the source code.

## Install and run

From `apps/api`:

```bash
npm install
npm run build
npm run dev
```

From `apps/web`:

```bash
npm install
npm run dev
```
