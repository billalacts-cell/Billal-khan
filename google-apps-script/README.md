# Google Apps Script Calibration Email Reminder Backend

This directory contains the production-ready Google Apps Script backend (`Code.gs`) that uses `MailApp` and your Google Spreadsheet data to automatically monitor calibration due dates and send reminder notifications to configured recipients.

---

## What This Script Does

1. **Directly reads your existing Google Spreadsheet**:
   - Matches spreadsheet `1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk` (or any sheet bound to the script).
   - Automatically detects the active tab (`Equipment`, `Calibration`, or `Form Responses 1`).
   - Automatically detects columns (`Calibration Due Date`, `Equipment ID / Asset No`, `Equipment Name`, `Category`, `Location`, `Project`).
2. **Prevents Duplicate Emails**:
   - Automatically adds and tracks a `Last Notified Date` column in your spreadsheet.
   - Idempotently prevents sending duplicate emails for the same calibration due date.
3. **Automated Daily Trigger (8:00 AM Asia/Riyadh)**:
   - Schedules a daily time-driven trigger that runs every morning.
   - Evaluates equipment due dates against current Riyadh time.
   - Sends emails **20 calendar days before the due date**.
   - Includes **Overdue items** in an urgent red alert banner.
4. **Logs All Runs**:
   - Records all notification batches and status in a `Calibration_Reminder_Logs` tab.
5. **Web App Integration with Application**:
   - Exposes secure `doGet` and `doPost` endpoints for ping, test emails, and manual triggers directly from the web interface.

---

## Step-by-Step Deployment Guide

### Step 1: Open Google Apps Script
1. Open your Google Spreadsheet:
   [https://docs.google.com/spreadsheets/d/1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk](https://docs.google.com/spreadsheets/d/1-zp0508H-nlZNPql2JQlQClK1aRYF1vFqn7y9U3L6kk)
2. In the top menu bar, click **Extensions > Apps Script**.
3. A new browser tab opens with the Apps Script editor.

### Step 2: Paste the Code
1. In the left files list, select `Code.gs`.
2. Clear any default code inside `Code.gs`.
3. Copy the entire contents of `google-apps-script/Code.gs` and paste it into the editor.
4. Press `Ctrl + S` (or `Cmd + S`) to save.

### Step 3: Run Initial Authorization & Schedule Daily Trigger
1. At the top of the Apps Script editor, locate the function dropdown (next to "Run" and "Debug").
2. Select **`createDailyCalibrationTrigger`**.
3. Click **Run**.
4. Google will display a popup: **"Authorization required"**.
   - Click **Review Permissions**.
   - Choose your Google account (`billal.acts@gmail.com`).
   - If you see "Google hasn't verified this app", click **Advanced** (bottom left), then click **Go to Untitled project (unsafe)**.
   - Click **Allow** to permit the script to send emails via `MailApp` and access the spreadsheet.
5. The daily 8:00 AM trigger is now active!

### Step 4: Deploy as a Web App
1. In the top right corner, click the blue **Deploy** button > **New deployment**.
2. Click the gear icon (⚙️) beside "Select type" and choose **Web app**.
3. Fill in the deployment details:
   - **Description**: `Calibration Reminder API`
   - **Execute as**: `Me (billal.acts@gmail.com)`
   - **Who has access**: `Anyone` (recommended for seamless backend-to-backend communication)
4. Click **Deploy**.
5. Copy the **Web App URL** (format: `https://script.google.com/macros/s/.../exec`).

### Step 5: Connect in the Web Application
1. In your application, navigate to **Calibration > Receiver Email Settings**.
2. Scroll to the **Google Apps Script Integration** card.
3. Paste your **Web App URL**.
4. Click **Save & Test Connection**.
5. Once connected, click **Send Live Test Email** to verify immediate delivery directly to your inbox.
