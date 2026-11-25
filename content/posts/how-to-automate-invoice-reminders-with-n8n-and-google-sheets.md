---
title: "How to Automate Invoice Reminders with n8n and Google Sheets"
description: "Build an automated invoice tracking system using n8n and Google Sheets that generates PDFs and handles follow-ups without manual chasing."
date: 2026-11-25
category: "Business Operations"
tags: ["n8n", "invoice automation", "google sheets", "business operations", "pdf generation"]
---

Unpaid invoices are a quiet tax on your time. You issue a bill, set a mental calendar note for 14 days, and then find yourself drafting polite follow-up emails on a Friday afternoon. It feels small, but chasing three or four clients a week destroys your focus. 

The standard advice is to buy a heavy invoicing platform with a monthly subscription per user. For many agencies and service businesses, that is overkill. You usually just need a single, reliable system that knows when an invoice is generated, builds the PDF, emails the client, and sends firm reminders if the due date passes.

Here is how to build an invoice generator and reminder pipeline using n8n, Google Sheets, and a transaction email service like Resend or Postmark. 

## The Core Architecture

The system relies on three separate n8n workflows tied to one master Google Sheet. 

1. **Workflow 1: Invoice Generation.** Triggers when you mark a row as "Ready" in Google Sheets. It creates a branded PDF, saves it to Google Drive, updates the sheet with the PDF link, and emails the client with the invoice attached.
2. **Workflow 2: The Daily Status Check.** Runs once every morning at 08:00. It searches the sheet for unpaid invoices, calculates how many days overdue they are, and updates their status.
3. **Workflow 3: The Escalation Engine.** Reads the updated statuses and sends specific email templates based on the delay—3 days before due, 1 day overdue, and 7 days overdue.

By decoupling the daily check from the initial email, you avoid sending duplicate emails if a workflow fails halfway through.

## Step 1: Setting Up the Database

Your Google Sheet needs to act as a simple state machine. Set up a tab called `Invoices` with these exact columns:

* `Invoice ID` (e.g., INV-2024-001)
* `Client Name`
* `Client Email`
* `Amount`
* `Issue Date` (YYYY-MM-DD)
* `Due Date` (YYYY-MM-DD)
* `Status` (Draft, Ready, Sent, Paid, Reminded-1, Reminded-2, Overdue-Escalated)
* `PDF Link`
* `Last Email Sent Date`

When you want to issue an invoice, fill out the row and set the `Status` column to `Ready`.

## Step 2: Generating the PDF and Sending the First Email

In n8n, create a workflow triggered by a **Google Sheets Trigger** node set to watch for changes in the `Status` column where the value equals `Ready`.

```
[Google Sheets Trigger] -> [HTML Node (Invoice Template)] -> [n8n Render PDF Node] -> [Google Drive Node] -> [Resend / Postmark Node] -> [Google Sheets Update]
```

1. **Create the HTML Template:** Use an **HTML Node** to format your invoice. Populate variables directly from the Google Sheet trigger: `{{ $json["Client Name"] }}`, `{{ $json["Amount"] }}`, and `{{ $json["Invoice ID"] }}`.
2. **Render the PDF:** Pass the HTML output into an **n8n PDF Node** (or an external HTML-to-PDF API like APITemplate.io if you require complex custom fonts).
3. **Save and Email:** Upload the output file to a specific Google Drive folder. Then, use your SMTP or transactional email node to send the email with the binary PDF file attached.
4. **Update Row:** Finally, use a **Google Sheets Node** to update the row: set `Status` to `Sent`, `PDF Link` to the file URL, and `Last Email Sent Date` to today's date (`{{ $now.format('YYYY-MM-DD') }}`).

I built a similar pipeline for an internal billing setup. It handles branded PDFs and handles the initial push automatically. In over five months of operation, zero invoices were missed or sent late due to manual oversights.

## Step 3: Building the Daily Reminder Engine

Create a second workflow in n8n. Start with a **Schedule Trigger** set to execute every day at 08:00 AM.

Next, add a **Google Sheets Node** set to `Read Rows`. Filter the read action so it only pulls rows where `Status` is **NOT** equal to `Paid`.

Pass those rows into a **Code Node** to run the date math. You want to compare today's date against the `Due Date` field.

```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

for (const item of $input.all()) {
  const dueDate = new Date(item.json['Due Date']);
  dueDate.setHours(0, 0, 0, 0);

  // Calculate difference in days
  const diffTime = today - dueDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  item.json.daysOverdue = diffDays;
}

return $input.all();
```

After the Code Node, insert a **Switch Node** based on `daysOverdue` and the current `Status`:

* **Branch 1 (Upcoming Due Date):** `daysOverdue` equals `-3` AND `Status` equals `Sent`. 
  * *Action:* Send a gentle reminder email ("Invoice INV-2024-001 is due in 3 days"). Update `Status` to `Reminded-Pre`.
* **Branch 2 (First Overdue):** `daysOverdue` equals `1` AND `Status` is in `['Sent', 'Reminded-Pre']`.
  * *Action:* Send a direct follow-up email ("Invoice INV-2024-001 was due yesterday"). Update `Status` to `Reminded-1`.
* **Branch 3 (Final Warning):** `daysOverdue` equals `7` AND `Status` equals `Reminded-1`.
  * *Action:* Send a firm escalation email and tag your internal Slack channel. Update `Status` to `Overdue-Escalated`.

## What Usually Goes Wrong

Building the happy path takes an hour. Preventing edge cases takes longer. Here are the three places this system breaks if you do not design for them:

### 1. The Partial Payment / Offline Settlement Problem
A client pays via direct bank transfer, but forgets to reference the invoice number. You do not update the Google Sheet immediately. On day 7, the system sends an aggressive automated reminder to a client who has already paid.

*The fix:* Keep your initial reminders friendly and neutral ("Our records show invoice X is unpaid. If you've already transferred this, please ignore this notice"). Also, assign one person to reconcile the Google Sheet against bank statements every Monday morning.

### 2. Timezone Offsets Marking Invoices Overdue Early
If your n8n server sits in UTC and your client is in Australia, running a simple `new Date()` script at midnight UTC can cause an invoice to trigger a day early or late.

*The fix:* Hardcode the timezone in your n8n workflow settings or explicitly set timezone offsets using Luxon inside your n8n Code nodes (`DateTime.now().setZone("Europe/London")`).

### 3. Email Threading Failures
If every reminder email sends with a brand new Subject line (e.g., "Reminder 1", "Reminder 2"), the client gets five isolated emails. They lose context, and your messages look like uncoordinated spam.

*The fix:* Pass the original email's `Message-ID` or keep the `Subject` identical while using an `In-Reply-To` header if your provider supports it. If using simple SMTP, keep the subject line consistent: `[Invoice INV-2024-001] Payment Notice`.

## Limits and Costs

This setup costs almost nothing to run. 

* **n8n:** Can be self-hosted on a $5/month server or run on n8n Cloud ($20/month).
* **Google Sheets:** Free.
* **Resend / Postmark:** Both offer generous free tiers (Resend gives 3,000 emails/month free).

The limitation is scale. If you are issuing more than 500 invoices a month, Google Sheets will eventually suffer from lockouts or slow read/write API responses when hit by parallel requests. At that point, swap Google Sheets for a proper relational database like PostgreSQL or Airtable, keeping the rest of the n8n logic identical.
