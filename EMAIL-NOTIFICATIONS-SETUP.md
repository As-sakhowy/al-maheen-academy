# Al-Maheen Academy email notifications

## Free trial notifications

The notification emails use Al-Maheen Academy's green and gold visual identity, the Academy tree logo hosted on the public website, the Academy tagline, a clear free-trial details panel, and event-specific next steps. Both HTML and plain-text versions are sent for email-client compatibility.

The admin dashboard sends transactional emails through Resend after a free-trial status or proposed time has been successfully saved in Supabase.

Email events:
- Accept trial: sends an acceptance update. This does not mean the time is booked.
- Reject trial: sends a rejection update.
- Save a different suggested date/time: sends a rescheduling proposal and asks the parent to confirm it.
- Mark as booked: sends the booking confirmation after the administrator has confirmed the arrangement with the parent.

If an email cannot be sent, the database update remains saved. The dashboard reports that the email was not sent so the administrator can contact the parent manually using the email and WhatsApp links in the trial details.

The API does not send another status email when the administrator saves the same status again. It sends a rescheduling email only when the proposed date/time changes.

## 1. Prepare Resend

1. Create or sign in to a Resend account.
2. Create an API key with permission to send email.
3. For initial testing only, use `Al-Maheen Academy <onboarding@resend.dev>` as `EMAIL_FROM`. Resend's testing sender has recipient restrictions, so test only with an address Resend permits (start with the email address associated with your Resend account).
4. For normal parent notifications in production, purchase a domain you control, add it to Resend, complete the DNS verification steps Resend provides, and then use a sender address on that verified domain, such as `Al-Maheen Academy <notifications@your-real-domain.com>`.

You do not need to buy a domain just to prepare and test the integration locally. The Resend testing sender is not a permanent production sender.

Do not put the Resend API key in `admin/config.js`, browser JavaScript, GitHub, or chat.

## 2. Add server environment variables

For local testing, add these to your private `.env.local` file in the project root:

```env
RESEND_API_KEY=re_your_actual_private_key
EMAIL_FROM="Al-Maheen Academy <onboarding@resend.dev>"
```

Replace the key placeholder with your private Resend API key. Do not put the key in browser files, GitHub, or chat. Keep all existing Supabase variables in `.env.local`. Never upload `.env.local`.

You do not need to add these values to Vercel Production until you have a domain verified with Resend. When you are ready for production, add `RESEND_API_KEY` and the verified-domain `EMAIL_FROM` under Vercel → Project → Settings → Environment Variables, select the appropriate environments, and redeploy.

## 3. Create the notification log table

Open Supabase → SQL Editor and run the contents of `SUPABASE-NOTIFICATION-LOGS.sql`.

The table stores the recipient, event, provider message ID, send status, and any safe error summary. It does not store the full email body. The API writes logs using the server-side service-role key; no browser access policy is created.

## 4. Test before production

Use a test free-trial record with an email address you control.

1. Accept the trial and confirm the record status changes and an email arrives.
2. Reject a separate test trial and check the rejection email.
3. Change the suggested date/time and confirm the email shows both the student's local time and the Academy's Africa/Lagos time.
4. Confirm the booking with the parent, then use Mark as booked and check the confirmation email.
5. Temporarily remove or misconfigure the email environment variable in Preview and verify that the status still saves while the dashboard warns that no email was sent.

Check `notification_logs` in Supabase to review sent, failed, and skipped attempts.

## Important

- A verified sender domain is required for reliable production sending. Resend may reject messages if the sender is not verified.
- Acceptance is not booking confirmation. The parent and Academy should agree on the time before using Mark as booked.
- Rescheduling updates the suggested time, it does not automatically confirm the booking.
- WhatsApp remains a manual contact option. This update does not send WhatsApp messages automatically.
