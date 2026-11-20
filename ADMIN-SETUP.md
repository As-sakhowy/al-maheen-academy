# Al-Maheen Academy Admin Dashboard Setup

This adds a private HTML/CSS/JavaScript admin area to the existing static website. It does not replace the public pages.

## Included

- `/admin/login.html`: Supabase Auth sign-in.
- `/admin/index.html`: private dashboard overview and management sections.
- `/api/admin.js`: server-side API. It validates the Supabase access token and checks `public.admin_users` before reading or changing records.
- Dashboard sections: overview, students, free trials, classes, teachers, payments, invoices, courses, enrolments and reports.

## 1. Install dependencies locally

From the project root run:

```bash
npm install
```

## 2. Configure the browser-safe Supabase settings

In Supabase, open **Project Settings → API** (the labels may vary slightly).

Copy:
- Project URL
- Publishable key (or legacy `anon` key)

Edit `admin/config.js` and replace the two placeholders:

```js
window.ALMAHEEN_SUPABASE = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY'
};
```

The publishable/anon key is intended for browser use and is protected by database policies. **Never put the service-role key in `admin/config.js`, HTML, or any other browser file.**

## 3. Configure Vercel server environment variables

In Vercel → Project → Settings → Environment Variables, add these three variables for Preview and Production:

- `SUPABASE_URL` = your Supabase Project URL
- `SUPABASE_ANON_KEY` = your publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role/secret key

The service-role key is server-only and bypasses RLS. Keep it private, do not commit it, and do not paste it into chat. If it has ever been exposed publicly, rotate it in Supabase.

For local development, create a `.env.local` file in the project root with the same variables. `.env.local` is ignored by Git. Do not upload it to GitHub.

## 4. Confirm the administrator account

The Supabase Auth user must already exist and its UUID must have a matching row in `public.admin_users`. Only users in that table can pass the admin API check.

## 5. Test locally

Run:

```bash
npx vercel dev
```

Then open `http://localhost:3000/admin/login.html`. Sign in with the administrator email and password created in Supabase Authentication.

## 6. Deploy

Commit and push the project to the GitHub branch connected to Vercel. Confirm the Vercel deployment completes, then visit:

`https://YOUR_SITE_DOMAIN/admin/login.html`

## Important current integration boundary

The dashboard reads and manages records already stored in the Supabase tables. The existing public `api/register.js` and `api/trial.js` in this recovered website still use the Google Sheets integration described in `README-REGISTRATION-SETUP.md`. They have **not** been silently switched to Supabase in this package. Until the public registration APIs are migrated and tested, public form submissions will not automatically appear in the dashboard's Supabase student/trial lists. Do not advertise the new dashboard as fully connected to public forms yet.

The dashboard supports manual creation of student and teacher records, trial status changes, and selected status updates. It does not yet create recurring classes, invoices, payment gateway transactions, or attendance sessions from its interface. Those workflows require additional screens and validation before production use.

## Database notes

The SQL tables and policies created during the guided setup are expected to exist. The dashboard uses these tables/views:

- `admin_users`, `guardians`, `students`, `courses`, `enrollments`
- `free_trials`, `recurring_classes`, `class_students`
- `teachers`, `class_teachers`, `attendance`
- `tuition_plans`, `invoices`, `invoice_items`, `payments`
- `invoice_balances`, `monthly_revenue`, `attendance_summary`, `student_enrollment_overview`

The dashboard is an initial administrative implementation. Test it with non-sensitive sample records before entering real family or student information. Publish a suitable privacy notice and follow applicable child-data requirements before collecting children's information.


## Free-trial email notifications

The dashboard can send email updates when an administrator accepts, rejects, reschedules, or confirms a free trial. Configure Resend and create the notification log table using the instructions in `EMAIL-NOTIFICATIONS-SETUP.md` before enabling this in production. Email credentials belong only in Vercel server environment variables, never in browser files.
