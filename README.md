# SmartLand Frontend (Next.js)

This project now runs on **Next.js (App Router)** with React, TypeScript, Tailwind CSS, and shadcn/ui components.

## Tech Stack

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui

## Project Structure

- `src/app/layout.tsx` - Root Next layout and metadata
- `src/app/[[...slug]]/page.tsx` - Catch-all client page that renders the app shell
- `src/App.tsx` - Client application shell (providers + route tree)
- `src/views/*` - Existing feature pages used by `react-router-dom`
- `src/index.css` - Global Tailwind and base styles
- `next.config.ts` - Next.js config (env mapping + API rewrites)

## Environment Variables

Use `.env.local` and prefer `NEXT_PUBLIC_*` values:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_ORIGIN`
- `NEXT_PUBLIC_EMAILJS_SERVICE_ID`
- `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`
- `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`
- `NEXT_PUBLIC_EMAILJS_LC_DECISION_TEMPLATE_ID`
- `NEXT_PUBLIC_LANDS_COMMISSION_PHONE`
- `NEXT_PUBLIC_ARBITRATOR_PHONE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_PURGE_LOCAL_IDENTITY_NAMES`

## Commands

Install dependencies:

```shell
npm install
```

Run development server:

```shell
npm run dev
```

Build production bundle:

```shell
npm run build
```

Start production server:

```shell
npm run start
```
