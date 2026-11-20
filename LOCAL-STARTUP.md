# Al-Maheen Academy local startup

This patch makes local startup easier and keeps the temporary Resend environment diagnostic available as a comment.

## Files in this patch

- `api/admin.js`: the working custom email notification code is preserved. The temporary `RESEND DIAGNOSTIC` log is now commented out, not deleted.
- `start-local.ps1`: loads `RESEND_API_KEY` and `EMAIL_FROM` from `.vercel/.env.development.local` into the current PowerShell process, without displaying their values, then runs `vercel dev`.

## Apply the patch

1. Stop the current local server with `Ctrl + C`.
2. Make a backup copy of your existing `api/admin.js`.
3. Extract this ZIP into the root of your existing `Al-Maheen-Academy` project folder and allow `api/admin.js` to be replaced.
4. Keep your existing `.env.local`, `.vercel` folder, `.git` folder, and all other project files. This patch does not include or replace them.

## Start the local server

Open PowerShell in the project root and run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\start-local.ps1
```

The script reads only the two required Resend variables from `.vercel/.env.development.local`. It does not print or write secret values. Leave that terminal open while testing the site. Stop the server with `Ctrl + C`.

If the script reports that a variable is missing, refresh the linked Vercel Development environment first:

```powershell
vercel pull --environment=development
```

Then run `.\start-local.ps1` again.

## Re-enable the diagnostic later

In `api/admin.js`, inside `sendTrialNotification`, the diagnostic is retained as four commented lines. Remove the `//` at the start of those lines only when you need to troubleshoot environment loading again. Comment them out again after troubleshooting.

## Notes

- Do not upload `.env.local` or `.vercel/.env.development.local` to GitHub or share them. They contain private credentials.
- This launcher is for local development. Production Vercel environment variables are configured separately in the Vercel project settings.
