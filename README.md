# Dining Tracker — clean setup

A shared eating-out tracker for two iPhones. Type in what you paid for a meal (including the tip) and see what's left for the week.

**Budget rules:** the monthly budget is split across the month by days. Weeks run Sunday to Saturday. Money left over rolls into the next week, and overspending comes out of the next week. Everything resets on the 1st.

Setup takes about 20 minutes. Do the steps in order.

---

## 1. Supabase logins

**Authentication → Users**
- If either parent is listed more than once, or you're unsure about one, delete them.
- Then **Add user → Create new user** for each parent: email plus a password, with **Auto confirm user** ticked. Write down exactly what you typed.

**Authentication → sign-in / provider settings:** turn **off** "Allow new users to sign up".

## 2. Database (one file)

1. Open `supabase/setup.sql`. In **STEP 3** at the bottom, change the 2 emails, the 2 names, and the budget.
2. In Supabase, go to **SQL Editor → New query**, paste in the **whole** file, and click **Run**.
3. The result at the bottom must list **both parents**, each with `confirmed = true`. If one is missing, their email doesn't match Authentication → Users. Fix it and run the file again (it wipes the database and rebuilds it every time).

## 3. config.js

In Supabase, go to **Project Settings → API** (or **API Keys**) and copy two things into `config.js`:
- **Project URL**, which looks like `https://abcdefgh.supabase.co`. No `/` at the end.
- **anon / publishable key**. Copy the whole thing. Never the `service_role` / secret key.

Keep the quote marks and add no spaces inside them. If you get this wrong, the app shows a **Setup problem** screen telling you exactly what to fix.

## 4. GitHub Pages

1. In your repo, delete all the old files, then upload everything in this folder **except** `supabase/` and `tests/`: `index.html`, `app.js`, `budget.js`, `config.js`, `manifest.json`, and the `icons` folder.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, then `main` and `/ (root)`. Wait 1–2 minutes after uploading.
3. Open `https://YOUR-USERNAME.github.io/REPO-NAME/` on your laptop and sign in as each parent to test.

## 5. Phones

On each phone, delete the old home-screen icon. Open the link in **Safari**, tap **Share**, then **Add to Home Screen**, and sign in.

---

## If something still fails

The app always shows the reason in **(Details: …)**:

| Details say | Meaning | Fix |
|---|---|---|
| Invalid login credentials | Wrong email or password | Re-create the user in step 1 and type carefully |
| Email not confirmed | Auto confirm wasn't ticked | Re-create with it ticked, then rerun `setup.sql` |
| Failed to fetch / Load failed | The device can't reach Supabase | If other devices work: turn off VPN, content blockers, iCloud Private Relay |
| "Almost there" screen | That login isn't on the budget | Rerun `setup.sql` with the right emails |

**Changing things later:** you can change the budget in the app's Settings. To make weeks start Monday, set `WEEK_STARTS_ON = 1` in `budget.js`. To check the budget math still works: `node tests/budget.test.mjs`.
