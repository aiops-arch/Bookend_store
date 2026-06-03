# Host Book Ends for FREE (perfect for under ~10 users)

No paid server. The whole app runs on one **free** service, and your database is
already free. Total cost: **₹0 / month.**

```
   DATABASE  →  Neon (free cloud PostgreSQL — you already use it)     ₹0
   APP       →  Render free web service (backend serves frontend too) ₹0
```

It runs 24/7 in the cloud — **your PC can be off**, and anyone (any floor, even
home) opens one link and logs in.

> Only catch on the free tier: if **nobody** uses it for 15 minutes it "sleeps,"
> so the *first* visit after idle takes ~30 seconds to wake. Step 6 removes even
> that. Totally fine for a small team.

---

## Step 1 — Put the code on GitHub (free, ~5 min)
1. Make a **free** account at github.com and create a **private** repo named `book-ends`.
2. On your PC, in the project folder, run:
   ```
   cd E:\Store_KG
   git init
   git add -A
   git commit -m "Book Ends"
   git branch -M main
   git remote add origin https://github.com/<your-username>/book-ends.git
   git push -u origin main
   ```
   (Your `.env` files are git-ignored, so **no passwords are uploaded.**)

## Step 2 — Create the free app on Render
1. Make a **free** account at **render.com** (no card needed for the free tier).
2. Click **New → Blueprint** → connect your `book-ends` GitHub repo.
   Render reads `render.yaml` and sets everything up automatically.

## Step 3 — Add your database link (one secret)
When Render asks for environment variables, set **`DATABASE_URL`** to your Neon
link. You'll find it in `backend\.env` on your PC (the line starting
`DATABASE_URL=postgresql://...`). Paste that whole value.
*(JWT_SECRET is generated for you automatically.)*

## Step 4 — Deploy
Click **Apply / Create**. Render builds it (~3–5 min the first time).

## Step 5 — ✅ Log in
Render gives you a free address like:
```
https://book-ends.onrender.com
```
Open it on any device → log in **admin@fg.local / Admin@123** → change the password.

Done. The app is live 24/7, free, independent of your PC.

## Step 6 (optional) — Keep it from "sleeping"
So the first load is never slow:
1. Free account at **uptimerobot.com** (or cron-job.org).
2. Add a monitor that pings `https://book-ends.onrender.com/api/health` every **10 minutes**.
That keeps it awake during the day — still free.

---

## Alternatives (all free, same idea)
- **Koyeb** (koyeb.com) — free web service, deploy from the same GitHub repo.
- **Railway** — easy, but free credit is limited; fine for testing.

## Updating later
Change code on your PC → `git add -A && git commit -m "update" && git push`.
Render redeploys automatically.

## Notes
- **Database:** Neon's free tier easily handles <10 users. Nothing to set up — it's already running.
- **Invoice auto-entry:** the app is now in the cloud, but the invoice *reader*
  (Codex) still runs wherever you run it. To make invoice auto-entry run in the
  cloud too, we'd run the watcher on the host as well — ask me when you want that.
