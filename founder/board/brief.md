# Maketia

- What it is: a SaaS where creators build a sales landing page for a digital product (e-book, course, templates, packs) in a section editor, sell it through their own SasPay payment link, and deliver the file through a private download link once the payment is confirmed.
- Who it is for: French-speaking creators and solo entrepreneurs in West and Central Africa (Côte d'Ivoire, Sénégal, Cameroun, Bénin, Togo, Burkina Faso…) who sell or want to sell digital products online, mostly from a phone, and are paid in FCFA through SasPay. Most are not technical.
- What it sells, at what price: a monthly subscription to the tool. Prices are NOT decided yet. Working hypothesis from the founder's earlier mock-up: Gratuit (0 FCFA, 1 funnel, 1 product), Créateur (9 900 FCFA / month, 10 funnels, 25 products), Studio (about 24 900 FCFA / month, to be confirmed). Maketia takes no commission on sales.
- Where and how: online (web app, mobile-first). Buyers pay on the creator's own SasPay link; Maketia never holds the money and never asks for the creator's SasPay API key.
- Budget and constraints: budget not communicated. Product built by the founder with an AI coding assistant; no integrated AI model; no marketing e-mails (transactional only); no production deployment yet.

## What exists today (tested)
- Section editor (11 section types), desktop/mobile preview, versions and restore, review checklist before publishing, templates.
- Publishing on a subdomain or a verified custom domain; A/B tests with honest statistics (warns when the sample is too small).
- Products with a SasPay payment link pasted by the creator; orders created at checkout; the creator confirms a payment by hand; private files (50 MB max) delivered by expiring, download-capped links.
- Contacts / CRM, analytics, plans and quotas (admin-set), account settings.
- External AI agents (Claude, etc.) can edit pages through MCP; publishing requested by an agent waits for human approval.

## Not done yet (blocked or missing)
- Automatic payment confirmation from SasPay webhooks (signature format undocumented to us) → no automatic delivery yet.
- No transactional e-mail provider: the creator sends the download link to the buyer.
- No online payment for Maketia subscriptions (plans assigned by an admin).
- Meta Pixel / Conversions API not built. Files stored on local disk (no S3).

## The public landing page (to judge as well)
Screenshots: founder/landing-review/v2/ (desktop full page, desktop top, mobile full, mobile top, dark mode top). Source: src/app/page.tsx.
Sections: hero ("Ta page de vente, montée en dix minutes."), "Ce que tu peux vendre" strip, six-step journey, six features, editor section, pricing (reads admin plans; currently "Tarif à définir"), FAQ, final call.
The founder wants the landing page to be both a strong salesperson and a beautiful "page de séduction", without any false claim.
