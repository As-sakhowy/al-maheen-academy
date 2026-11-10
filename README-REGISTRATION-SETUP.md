# Al-Maheen Academy registration system setup

The registration page and API are prepared, but Google Sheets will not save submissions until the private Google credentials are configured in Vercel. Do not publish real credentials in this repository or in browser JavaScript.

## Included
- `register.html`, `register.css`, `register.js`: mobile-friendly form, 7 course cards, maximum 4 selections, validation and automatic WhatsApp hand-off after successful saving.
- `api/register.js`: server-side validation and Google Sheets append, generated Registration ID, basic bot trap and spreadsheet-formula protection. It also stores the selected session duration, weekly frequency and estimated monthly fee.
- The homepage has separate calls to action for free-trial requests and general registration.

## 1. Create the Google Sheet
1. Create a new Google Sheet in the Google account you want to use for Al-Maheen Academy.
2. Rename the first tab exactly `Registrations`.
3. Put these headers in row 1, columns A to S:
   `Registration ID | Submitted At (UTC) | First Name | Last Name | Email | WhatsApp Number | Country | Registering For | Age Group | Courses | Current Level | Class Format | Preferred Times | Notes | Status | Consent | Session Duration | Lessons Per Week | Estimated Monthly Fee (USD)`
4. Copy the spreadsheet ID from the address bar. It is the text between `/d/` and `/edit`.

## 2. Create a Google service account
1. In Google Cloud Console, create/select a project and enable **Google Sheets API**.
2. Create a service account and create a JSON key for it. Keep the downloaded key private.
3. Copy the service account email address.
4. Share the Google Sheet with that service account email as **Editor**. Do not make the spreadsheet public.
5. From the JSON key, copy the `private_key` value exactly. Do not upload the JSON key into the website repository.

## 3. Configure Vercel environment variables
In Vercel, open the project that deploys this website, then Settings → Environment Variables. Add:
- `GOOGLE_SHEET_ID`: spreadsheet ID from step 1.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: service account email from step 2.
- `GOOGLE_PRIVATE_KEY`: complete private key value including the BEGIN/END lines. If entering it as one line, preserve newlines as `\n`.

Apply them to the Production environment (and Preview if needed), save, then redeploy the site. Keep these variables server-side only. Never use a `VITE_` or other public-prefixed variable for secrets.

## 4. WhatsApp destination
`register.js` currently uses `2348143160876`, the academy contact number already present in the uploaded homepage. Confirm this is the regular WhatsApp Messenger number you use for Al-Maheen Academy before publishing. Use digits only with the country code, without `+`, spaces or dashes. Changing this value later will not affect the form or stored registrations.

## 5. Test before sharing publicly
1. Deploy to a Vercel Preview URL first.
2. Submit a test registration using your own test details.
3. Confirm a new row appears in the private Google Sheet and includes an `AMA-YYYY-XXXXXXXX` Registration ID.
4. Confirm the success panel appears only after the row is saved, then the browser navigates to WhatsApp with a prefilled message. WhatsApp will not send it automatically; the person must press Send.
6. Test required fields, no course selected, five attempted course selections, and a simulated missing Google configuration.
7. Delete test personal data from the sheet when testing is complete.

## Technical notes
- The frontend calls `/api/register`, a Vercel serverless function in `api/register.js`.
- IDs use a random UUID-derived suffix to reduce collision risk; they are not sequential counters.
- The API validates all accepted course names and the four-course maximum on the server as well as the browser.
- Google Sheets is an operational registration log, not a complete student-management database. Restrict Sheet access and review retention of children's data.
- This starter does not include an admin dashboard, email notifications, a CAPTCHA, or persistent IP-based rate limiting. Add these if registration volume or abuse warrants them.

## Pricing page update
- `pricing.html`, `pricing.css`, and `pricing.js` provide the monthly pricing page.
- The $8 hourly rate is calculated using four weeks per month. Parents can switch between two and three lessons weekly.
- Choosing a plan opens `register.html` with the duration and weekly frequency preselected.
- The registration form calculates the estimated monthly fee and submits the selected plan details to the API.
- Add three new headers in columns Q:S of the `Registrations` sheet: `Session Duration`, `Lessons Per Week`, `Estimated Monthly Fee (USD)`. The API now appends through column S.
- These amounts are estimates until the academy approves the student's final timetable. This version does not collect payment or automatically enrol a student.


## Stage 2: Free trial requests and time zones

- `trial.html`, `trial.css`, and `trial.js` provide a separate free-trial request form. The existing general registration form remains available.
- `api/trial.js` validates the request server-side, creates an `AMA-STU-YYYY-XXXXXXXX` student reference ID, and stores the request with `Pending Approval` status. It does not confirm or book the requested time.
- The form collects parent/guardian contact details, student name and age group, programme choices, student country, IANA time zone, preferred local date/time and a 20- or 30-minute trial duration.
- The student time and equivalent `Africa/Lagos` time are displayed together. The conversion uses the IANA time-zone database and handles daylight-saving gaps and repeated times by asking the visitor to choose another time. The server independently recalculates the conversion; it does not trust the browser's submitted conversion.
- A duplicate trial request is checked using student first name, last name and parent/guardian email against existing `Free Trial` rows. This is a practical first-launch duplicate check, not a concurrency-proof identity system. Do not treat it as proof of a person's identity.
- A successful submission is saved as pending, then the browser navigates to WhatsApp with a prefilled message. WhatsApp is not sent automatically and the trial is not confirmed until an administrator contacts the family.

### Add these Google Sheet headers

Keep existing columns A:S unchanged. Add the following headers to row 1 in columns T:AF, in this exact order:

`Request Type | Student First Name | Student Last Name | Parent/Guardian Email | Student Time Zone | Preferred Trial Date (Student Local) | Preferred Trial Time (Student Local) | Preferred Trial Time (UTC) | Equivalent Academy DateTime (WAT) | Trial Duration (Minutes) | Trial Status | Student Reference ID | Admin Notes`

The trial API reads columns T:W to check whether the same student name and parent/guardian email have already requested a free trial, and appends through column AF. Keep the spreadsheet private and share it only with the academy administrator and the server service account.

### Important limits for this stage

- Trial requests are saved as pending. No email notification, calendar booking, automatic approval, conflict checking or admin dashboard is included yet; those belong to later stages.
- Google Sheets does not provide an atomic uniqueness constraint for this duplicate check. If two identical requests arrive simultaneously, a duplicate may still be possible.
- No payment is collected for a trial.
- Before collecting real children's information, publish an appropriate privacy notice and collect only information needed to arrange learning.


## Stage 2.1: Updated navigation, family pricing and registration preferences

- The homepage course navigation now points to the lowercase `#courses` section ID. The header menu is Home, About Us, Courses, Pricing, Register / Free Trial, and Contact Us.
- The Pricing page includes a Family Learning section describing learning together, shared scheduling and family learning support. Family pricing is quoted after the academy confirms the number of learners and whether they will share a class; no unsupported fixed family price is advertised.
- Both the trial and general registration forms now use a consistent `Who is the registration for?` choice. If the learner selects Myself, the contact person's name is also used as the student name. If registering a child or another family member, separate student names are collected.
- The general registration form now includes an IANA student time-zone selector, optional preferred weekly days, optional local date/time, and a live equivalent Lagos time preview. The server independently validates and converts the date/time. For recurring scheduling, preserve the student's local weekly day and time as the canonical schedule; the WAT equivalent may change when the student's region enters or leaves daylight-saving time.
- After a registration or trial request is successfully saved, the browser navigates to the Academy WhatsApp chat with a prefilled message containing the reference ID and submitted details. The visitor must still press Send in WhatsApp. If saving fails, the visitor is not redirected.

### Additional Google Sheet headings for general registrations

Keep A:AF exactly as described above. Add these headings in row 1, columns AG:AM, in this exact order:

`Registered Student First Name | Registered Student Last Name | Student Time Zone | Preferred Class Days (Student Local) | Preferred Class Date (Student Local) | Preferred Class Time (Student Local) | Equivalent Academy DateTime (WAT)`

The general registration API appends through column AM. It leaves T:AF blank on general registration rows because those columns are reserved for free-trial information. Do not insert or reorder columns A:AM after configuring the API.

### Final Google Sheet header map

- A:S: general registration/contact and pricing fields.
- T:AF: free-trial request fields.
- AG:AM: general registration student identity and preferred weekly schedule fields.

The trial API continues to write through AF. The general registration API writes through AM. Both use the same `Registrations` tab.

### WhatsApp redirect behaviour

The current public website contact number is configured in `register.js` and `trial.js` as `2348143160876`. Confirm this is the correct Al-Maheen Academy WhatsApp Messenger number before production deployment. After the server confirms the row was saved, the form redirects to `https://wa.me/` with a prefilled message. WhatsApp does not send the message automatically; the parent/student must press Send.
