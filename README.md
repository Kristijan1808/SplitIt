# SplitIt

React + TypeScript frontend, Node.js + Express + TypeScript backend, Prisma, Supabase PostgreSQL.

## 1. Install

```bash
npm install
```

## 2. Create Supabase database

Create a Supabase project, open **Connect**, and copy the **Supavisor Session Pooler** connection string on port `5432`.

Use it in:

```bash
apps/api/.env
```

Example:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
PORT=4000
WEB_ORIGIN="http://localhost:5173"
```

For serverless deployment, use transaction pooler port `6543` and add `?pgbouncer=true`.

## 3. Frontend env

```bash
cp apps/web/.env.example apps/web/.env
```

## 4. Prisma

```bash
cp apps/api/.env.example apps/api/.env
npm run db:generate
npm run db:migrate
```

## 5. Run

```bash
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000

## Features

- Create public group
- Public link sharing
- Add/edit/delete people
- Add/edit/delete payments
- Auto-calculate who pays whom
- Full change history
- Mobile-first green money-style UI
