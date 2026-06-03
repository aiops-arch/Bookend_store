# FG Inventory — Production Setup (the last mile)

This covers the few steps that need a software install or admin rights — things I
can't do automatically from a script, but that turn this from a "working prototype"
into a "real store system." Each is a one-time setup.

Current status of the system:
- ✅ Security hardened (strong login secret, security headers, locked access, rate limiting)
- ✅ Daily backups (`backup.bat`) + restore tool (`restore.js`) — disaster recovery ready
- ✅ Data cleaned (20 tidy categories), new-product-on-scan flow, one-click launcher
- ⬜ Local database (offline-proof)  ← needs PostgreSQL installed (step 1)
- ⬜ Auto-start on boot               ← needs one admin command (step 2)
- ⬜ Real passwords                   ← step 3
- ⬜ HTTPS                            ← see step 4 (usually not needed on a private LAN)

---

## 1. Local database — so the store works without internet  ⭐ (biggest win)

Right now your data lives in a cloud database (Neon). If the internet drops, the
system stops. A local database fixes that.

**Do this:**
1. Download & install **PostgreSQL 16** (free): https://www.postgresql.org/download/windows/
   - During setup, set a password for the `postgres` user and **remember it**.
   - Keep the default port **5432**.
2. After install, create the database. Open "SQL Shell (psql)" and run:
   ```sql
   CREATE DATABASE fg_inventory;
   ```
3. **Tell me it's installed** — I'll then:
   - export the full table structure from your current cloud database,
   - build it in the local one,
   - load your latest backup into it,
   - switch the app over (one line in `backend/.env`),
   - and verify everything still works.

   (This part is safe and I can do it in one go once PostgreSQL exists.)

> Until then, the cloud database keeps working — you lose nothing by waiting.

---

## 2. Auto-start when the PC turns on

So the system comes up by itself after a reboot (no one has to launch it).

**Do this once:** open **Command Prompt as Administrator** (right-click → "Run as
administrator"), then paste:
```
schtasks /create /tn "FG Inventory" /tr "E:\Store_KG\START-STORE.bat" /sc onlogon /f
```
Now `START-STORE.bat` runs automatically every time the PC logs in.
To remove it later: `schtasks /delete /tn "FG Inventory" /f`

---

## 3. Real passwords (before go-live)

The demo passwords (`Admin@123`, etc.) must be changed. Two easy ways:

- **In the app:** log in as Admin → change each user's password (Users / Profile screen).
- **Quick reset via API** (admin token), per user:
  ```
  POST /api/auth/reset-password   { "user_id": 2, "new_password": "YourStrongPass1" }
  ```
Rules: at least 8 characters, with an uppercase, a lowercase, and a number.

---

## 4. HTTPS — usually NOT needed on a private store WiFi

HTTPS encrypts traffic. On a **closed store network** (only your devices, behind your
router), plain http on the LAN is the normal, practical choice — adding HTTPS means
self-signed certificates that make browsers show scary warnings, which confuses staff.

**Recommendation:** keep http on the LAN. Only add HTTPS if you later expose the
system **outside** the store (over the internet) — in which case use a proper reverse
proxy (Caddy/Nginx) with a real certificate. Ask me when/if you get there.

---

## After all this → run the real trial
Take your scanner and do SETUP + INWARD + OUTWARD on 20–30 real products.
That real-world test matters more than any amount of automated checking.
