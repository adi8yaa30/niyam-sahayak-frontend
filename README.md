# Niyam Sahayak: dashboard

Trusted rules assistant for Government of Assam officers (NESFIC 2026, problem D-36).
Next.js (App Router) + TypeScript + Tailwind v4 + react-pdf.

## Run

```bash
npm install          # also copies the pdf.js worker, cMaps and fonts into public/pdfjs
npm run dev          # http://localhost:3000
```

With `NEXT_PUBLIC_API_URL` empty the app runs in **mock mode**: canned answers, sample PDFs in
`public/mock/` (plus `public/mock.pdf`), and a "Mock data" tag in the banner.
To use the real backend, create `.env.local`:

```
NEXT_PUBLIC_API_URL=https://niyam-sahayak.onrender.com
```

Mock-mode test hooks: a question containing "simulate slow" waits 17 s (shows the server-waking
message); "simulate error" shows the error state. Draft with "Casual leave" shows the amber
"rule not found" gap.

## Deploy (Vercel)

1. Push this folder to GitHub and import it in Vercel (framework: Next.js, defaults are fine).
2. Settings → Environment Variables: `NEXT_PUBLIC_API_URL` = your Render URL. Redeploy after changing it
   (it is baked in at build time).
3. On the backend, set `ALLOWED_ORIGINS` to the Vercel URL.
4. Before a demo, open the site once a minute early: it pings `/health`, which wakes Render's free tier.

## Where things are

| What | Where |
| --- | --- |
| Colours, fonts, radii (restyle here) | `src/app/globals.css` (`@theme`) |
| All API calls, mock switch, PDF URLs | `src/lib/api.ts` |
| Mock data | `src/lib/mock.ts`, PDFs from `scripts/make-mock-pdfs.py` |
| Quote matching for the highlight | `src/lib/highlight.ts` |
| PDF viewer (page jump, zoom, highlight) | `src/components/PdfViewerInner.tsx` |
| Source card, citation pill, status badge | `src/components/ui.tsx` |
| Screens | `src/components/{ask,library,draft,admin}/` |

## How the highlight works

On each page, pdf.js text items are joined into one string that keeps only letters, marks and digits
(so spacing, line breaks, hyphenation, curly quotes and punctuation never break a match), the quote is
normalised the same way, and the match is mapped back to character ranges in each text item, which
`customTextRenderer` wraps in `<mark>`. If the full quote isn't found, the longest prefix or suffix (24+
characters) is highlighted. If nothing matches, the cited page still opens with "Quote on this page: …",
and the viewer searches the other pages and offers "It appears on page N".
