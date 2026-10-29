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
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
```

For Google registration and sign-in, create a Google OAuth 2.0 Web application client. Set its client ID in both `api/.env` as `GOOGLE_CLIENT_ID` and `web/.env` as `VITE_GOOGLE_CLIENT_ID`. Add the web app's development and production origins to the OAuth client's authorized JavaScript origins. Google-verified email addresses become usernames. Apply the API Prisma migrations before deploying this feature.

The uploaded image is limited to 10 MB and accepted formats are JPEG, PNG, WebP, and GIF.

## Registered-only groups

Creating a registered-only group requires a signed-in account. The creator is added as a participant using their account username, and each signed-in member who joins with the group code and password gets one account-linked participant automatically. Registered-only groups do not allow manually adding participants. Participant ownership is linked by account ID, not inferred from a matching name.

Apply the API migrations before deploying the registered-only participant flow:

```bash
cd api
npx prisma migrate deploy
```

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
