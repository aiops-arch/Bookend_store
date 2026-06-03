# Go Live — host Book Ends in the cloud (always on, no PC needed)

This puts the whole app on a small cloud server so it runs 24/7, reachable from
any floor or from home, and **does not depend on your PC at all.** Your data
already lives in the cloud (Neon), so nothing is lost.

With only a few users the smallest/cheapest server is plenty.

> I can't buy the server for you (it needs your account + card). But once it
> exists, going live is **3 commands**. Here's exactly what to do.

---

## Step 1 — Create a server (≈5 min)
Pick one provider, make an account, create the cheapest Ubuntu server:

- **Hetzner** (cheapest, ~€4/mo): Cloud → New Project → Add Server →
  Image **Ubuntu 24.04**, type **CX22**, create. Note the **IP address**.
- **DigitalOcean** (simplest dashboard, ~$6/mo): Create → Droplet →
  **Ubuntu 24.04**, Basic / smallest, create. Note the **IP address**.

You'll get an **IP address** and a **root password / SSH key** by email or on screen.

## Step 2 — Connect to the server
On your PC, open a terminal and:
```
ssh root@YOUR_SERVER_IP
```
(enter the password when asked).

## Step 3 — Install Docker (copy-paste once)
```
curl -fsSL https://get.docker.com | sh
```

## Step 4 — Put the project on the server
Easiest: install git on your PC, push this folder to a private GitHub repo, then
on the server run `git clone <your repo> book-ends`.
Or copy it directly from your PC (run this **on your PC**, not the server):
```
scp -r "E:\Store_KG" root@YOUR_SERVER_IP:/root/book-ends
```

## Step 5 — Launch it (the 1 command)
Back on the **server**:
```
cd /root/book-ends
bash deploy.sh
```
It builds and starts everything. Wait ~1–2 minutes the first time.

## Step 6 — ✅ Log in
Open a browser (any device, any floor):
```
http://YOUR_SERVER_IP/
```
Login: **admin@fg.local / Admin@123** → then change the password.

That's it. The app now runs on the server 24/7. Turn your own PC off whenever
you like — the system stays up.

---

## Optional niceties
- **A proper web address + HTTPS** (e.g. `https://stock.yourshop.com`): point a
  domain at the server IP and put **Caddy** in front — ask me and I'll add it
  (auto free SSL certificate).
- **Invoice auto-entry on the server too:** the app runs here now, but the
  invoice *reader* (Codex) still runs wherever you run it. To make invoice
  auto-entry 24/7, run the watcher on the server:
  `cd /root/book-ends/backend && nohup node src/jobs/invoiceWatcher.js &`
  and have your reader drop JSON into `/root/book-ends/invoices/inbox`.

## Updating later
After changing code, on the server: `cd /root/book-ends && bash deploy.sh` again.

## Costs
- Server: ~$4–6/month. Database (Neon): free tier is fine for a few users.
- That's the whole running cost.
