# QA Testing Guide — ISBAT ERP (Faculty/Staff View)

This guide walks a QA tester through the portal exactly as a **faculty/staff member** would experience it in the browser, starting from the login screen. No technical setup steps — just open the site URL given to you and follow along.

## 1. Login Screen

You'll land on a **portal selector** with two options: **Staff** and **Student**.

- Click **Staff**.
- ✅ Check: you're taken to a staff ID + password form, with ISBAT branding, and no leftover student-related text.

## 2. Staff Sign-In

Enter your credentials:

| Field | Test value |
|---|---|
| Staff ID | `AR-2024-0001` |
| Password | `Admin@1234` |

Things to try:
- Leave both fields blank and click Sign In → should show a "required" message under each field, not submit.
- Enter a wrong ID or wrong password → should show **"Incorrect ID or password. Please check and try again."**
- Enter the correct ID and password above → should move you forward to a verification code screen.
- If there's a "Trust this device" or "Remember me" checkbox, tick it and confirm it doesn't skip the verification step.

## 3. One-Time Code Verification

After a correct sign-in, you should land on a screen asking for a 6-digit code, with a masked email shown (something like `m***@isbat.ac.ug`).

- Enter the wrong code → should show **"Incorrect code. Please check and try again."**
- Enter `123456` → should log you in and take you into the Academic dashboard.
- If there's a "Resend code" link, click it and confirm the page doesn't break or duplicate the form.
- Click any "Back" link and confirm you land back on the Staff sign-in screen (not a blank page, not the Student form).

## 4. Forgot Password (optional path)

From the sign-in screen, click **Forgot password**.
- Walk through the steps (request code → enter code → set new password).
- ✅ Check: each screen has a clear "what to do next" instruction, and there's always a way back to the login screen.
- Note: in this environment every code/reset step is accepted automatically, so you won't be able to test a "wrong code" case here — just check the screens themselves flow cleanly.

## 5. Once Logged In — General Look-Around

After logging in you land in the **Academic module**. Spend time just clicking around like a real staff member would:

- **Sidebar** — hover/click through the icons on the left rail; each should open a panel with a list of pages underneath it. Try collapsing and expanding sections.
- **Top header** — click your profile icon top-right; confirm a dropdown appears with at least a logout option.
- **Dashboard** — check that cards/widgets/tables render without a blank or broken area.

Then browse into a handful of pages one at a time (e.g. Batch Management, Timetable, Course Units, Student Lookup, Fee Structure) and for each one check:

- The page loads with a title and a populated table — not a blank screen.
- Click an **Add** or **Edit** button → a popup (modal) should appear over the page.
  - Clicking outside the popup (on the dimmed background) should close it.
  - Clicking inside the popup should **not** close it.
- Fill the popup form and Save → a small confirmation message (toast) should appear briefly in the corner, then disappear on its own after a few seconds.
- Try a delete/reject/deactivate style action → confirm it also shows a matching confirmation message, and ideally asks for confirmation first.
- If the table is wide, check for left/right scroll arrows and that they only show up when there's more content to scroll to.
- If there's an "Actions" button on a row, click it and confirm the menu isn't cut off or hidden behind other content, even on rows near the bottom or edge of the screen.

## 6. Other Areas to Walk Through

Beyond Academic, the sidebar/module switcher should also give you access to:

- **Admission** — applicants, enquiries, registration, vetting
- **Assessment** — exams, coursework, question banks, results
- **Finance** — payments, ledgers, receipts, financial reports
- **Student** — student records, statements, transfers
- **Employee** — employee records
- **Config** — general lookup/settings lists (campus, department, designation, etc.)

For each area you visit, the same checks apply: does it load cleanly, do the Add/Edit popups work, do confirmation messages appear correctly, does nothing look visually broken or cut off.

## 7. Logging Out

- Click your profile → Logout.
- ✅ Check: you're returned to the login screen, and pressing the browser's Back button afterward does **not** let you back into the dashboard without logging in again.

## 8. What to Report

For anything that looks wrong, note:
- Which page/screen you were on
- What you clicked or typed
- What you expected vs. what actually happened
- A screenshot if possible

Things that are expected and **not** bugs:
- Data resets if the page is refreshed — everything here is sample/demo data, not saved to a real system.
- The forgot-password flow always "succeeds" no matter what code you enter — that's expected in this demo environment.
