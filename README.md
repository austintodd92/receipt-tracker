# Dining Tracker

A shared eating-out tracker for two iPhones. Type in what you paid for a meal (including the tip) and see what's left for the week.

**Budget rules:** the monthly budget is split across the month by days. Weeks run Sunday to Saturday and are cut off at the end of the month. Money left over rolls into the next week, and overspending comes out of the next week. Everything resets on the 1st.

```
index.html, app.js, budget.js, config.js, manifest.json, icons/   ← the web app (GitHub Pages)
supabase/schema.sql                                               ← database + privacy rules
supabase/add-parents.sql                                          ← links the two logins to one budget
```

Setup takes about 30 minutes. Do the steps in order.

---

## 1. Set up Supabase

**a. Database.** Supabase dashboard, then **SQL Editor**, then **New query**. Paste all of `supabase/schema.sql` and click **Run**.

**b. Turn off public sign-ups.** Go to **Authentication**, then sign-in / provider settings, and turn **off** "Allow new users to sign up". This plus the database rules is what makes it "only them."

**c. Create the two logins.** Go to **Authentication**, **Users**, **Add user**, then **Create new user**. Enter each parent's email and a password, and tick **Auto confirm user**.

**d. Link them to one budget.** Open `supabase/add-parents.sql`, replace the two emails, names, and the monthly budget, then run it in the SQL Editor. The last query should list both parents.

**e. Get the app's keys.** Go to **Project Settings**, then **API** (or **API Keys**). Copy the **Project URL** and the **anon / publishable** key into `config.js`. Never use the `service_role` / secret key there.

## 2. Put the app online (GitHub Pages)

1. Create a GitHub repo, for example `dining-tracker`. Upload everything **except** the `supabase/` folder (uploading it is harmless, though, since it has no secrets). The free GitHub Pages plan needs the repo to be **public**. That's OK: the database rules keep the data private,.
2. In the repo, go to **Settings**, **Pages**, then **Deploy from a branch**, choose `main` and `/ (root)`, and **Save**.
3. After a minute, the site is at `https://YOUR-USERNAME.github.io/dining-tracker/`.

## 3. Put it on their iPhones

On each phone, open the link in **Safari** (not Chrome). Tap **Share**, then **Add to Home Screen**. Open it from the new icon and sign in. They'll stay signed in.

## 4. Test before handing it over

- [ ] Sign in as parent 1 and add a meal.
- [ ] Sign in as parent 2 on the other phone. The meal shows up, and "left this week" matches.
- [ ] Tap a meal to edit it, then delete it.
- [ ] Settings: change the budget. Summary: page back to last month.
- [ ] In a private Safari tab, signed out, the app shows only the login screen.

---

## Making changes later

- **Weeks start Monday instead of Sunday:** in `budget.js`, set `WEEK_STARTS_ON = 1`.
- **Updating the app:** commit to GitHub. The phones get the new version the next time the app is opened (there's no offline cache, on purpose, so updates show up right away).
- **Checking that the budget math still works:** `node tests/budget.test.mjs`
