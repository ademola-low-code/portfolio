---
title: "How to Prevent Double-Bookings Across Booking.com, Airbnb and Direct"
description: "Learn how to build a unified calendar sync using n8n and iCal feeds to block double-bookings across OTAs and direct channels automatically."
date: 2026-11-23
category: "Hospitality"
tags: ["hospitality", "n8n", "automation", "channel management"]
---

A guest books your apartment on Booking.com at 10:15 AM. At 10:18 AM, another guest confirms the same weekend via your direct website or a WhatsApp enquiry. By the time you open your phone at 10:30 AM, you have two paid reservations for one front door.

Cancelling a Booking.com reservation costs you penalty fees and lowers your search ranking. Cancelling a direct guest destroys your reputation before they even check in. If you manage two to ten properties, paying $40 to $100 per month for a commercial channel manager often feels like an unnecessary fixed cost. But relying on manual calendar updates is a direct route to an overbooking crisis.

Here is how to build a real-time, automated calendar sync using n8n that locks out double-bookings across Online Travel Agencies (OTAs) and direct channels, without paying monthly subscription fees per room.

## The Core Architecture: Centralised Availability

Most hosts try to sync channels to each other: Airbnb to Booking.com, Booking.com to Expedia, and Expedia back to Airbnb. This creates a web of delayed updates. iCal feeds from major OTAs only refresh every 15 to 45 minutes. That delay is your double-booking window.

To eliminate the window, you need a single source of truth that sits between your channels. Every incoming booking must hit this central hub first, reserve the dates instantly, and then push updated blockout dates out to all channels.

```
[ Booking.com / Airbnb / Direct ]
              │
              ▼
      [ n8n Webhook / Cron ]
              │
              ▼
   [ Central Database / Sheet ] ──► (Instant Check: Is Date Free?)
              │
     ┌────────┴────────┐
  (Yes)              (No)
     │                 │
     ▼                 ▼
[Write Lock]    [Reject & Notify]
     │
     ▼
[Export Central iCal Feed]
```

When I built ELARA—a WhatsApp concierge for a luxury spa—the core requirement was live capacity control. If a guest requested a slot, the system had to verify live availability and write a temporary lock within two seconds. If two people clicked simultaneously, only the first transaction completed. The exact same logic applies to boutique hotels and short-let apartments.

## Step 1: Create the Master Calendar Ledger

Start with a dedicated database. A PostgreSQL table is ideal, but a structured Google Sheet works reliably if read/write operations are handled carefully.

Set up a table named `reservations` with these mandatory columns:

- `id` (UUID or auto-increment integer)
- `property_id` (Text, e.g., `apt-01`)
- `check_in` (Date format: `YYYY-MM-DD`)
- `check_out` (Date format: `YYYY-MM-DD`)
- `source` (Text: `booking_com`, `airbnb`, `direct`, `whatsapp`)
- `status` (Text: `confirmed`, `blocked`, `cancelled`)

Never store dates as non-standard text strings like "12th Oct". Always enforce ISO dates (`YYYY-MM-DD`) so your workflow can run mathematical date comparisons.

## Step 2: Capture Direct and Webhook Bookings Instantly

Direct bookings from your website, WhatsApp, or phone inquiries must write to this ledger immediately.

In n8n, create a workflow triggered by a Webhook Node listening for direct booking submissions.

1. **Webhook Node**: Receives `property_id`, `check_in`, `check_out`, and guest details.
2. **Execute Query Node**: Check the database for overlapping dates before accepting the booking.

Use this SQL query pattern to detect overlaps:

```sql
SELECT count(*) 
FROM reservations 
WHERE property_id = 'apt-01'
  AND status IN ('confirmed', 'blocked')
  AND check_in < '2026-04-20' 
  AND check_out > '2026-04-15';
```

If the returned count is greater than zero, the property is occupied. The workflow immediately routes to an error node, returning a failure response to the front-end or sending an alert to your team.

If the count is zero, the workflow writes the new reservation record with a status of `confirmed`.

## Step 3: Poll OTA iCal Feeds Every 5 Minutes

Airbnb and Booking.com expose exportable `.ics` (iCal) URLs for every listing. While they do not send webhooks when a guest books, you can poll their iCal feeds continuously.

1. Add a **Schedule Trigger Node** in n8n set to run every 5 minutes.
2. Add an **HTTP Request Node** to fetch the secret iCal URL from Airbnb or Booking.com.
3. Pass the response raw text into a **Code Node** to parse the iCal format into standard JSON objects.

Here is the JavaScript code for the n8n **Code Node** to extract start and end dates from an iCal file:

```javascript
const rawData = $input.first().json.data;
const events = [];
const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
const matches = rawData.match(veventRegex) || [];

for (const match of matches) {
  const dtstartMatch = match.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
  const dtendMatch = match.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/);
  const summaryMatch = match.match(/SUMMARY:(.*)/);

  if (dtstartMatch && dtendMatch) {
    const startDate = `${dtstartMatch[1].slice(0,4)}-${dtstartMatch[1].slice(4,6)}-${dtstartMatch[1].slice(6,8)}`;
    const endDate = `${dtendMatch[1].slice(0,4)}-${dtendMatch[1].slice(4,6)}-${dtendMatch[1].slice(6,8)}`;
    
    events.push({
      json: {
        check_in: startDate,
        check_out: endDate,
        summary: summaryMatch ? summaryMatch[1].trim() : 'Reserved'
      }
    });
  }
}

return events;
```

4. Pipe the output into an **If Node** or database upsert query to check if these dates already exist in your `reservations` table. If they do not, insert them with the source `airbnb` or `booking_com`.

## Step 4: Export a Single Master iCal Feed

Now that your database holds every single booking—direct, WhatsApp, Airbnb, and Booking.com—you must generate one master iCal URL.

Build a separate n8n workflow:

1. **Webhook Node**: Set the path to `/calendar/apt-01.ics`.
2. **Database Node**: Fetch all `confirmed` and `blocked` records for `apt-01` where `check_out >= CURRENT_DATE`.
3. **Code Node**: Format the database records into a valid iCal text string.
4. **Respond to Webhook Node**: Return the text with the header `Content-Type: text/calendar`.

Paste this master iCal URL into the "Import Calendar" section of Airbnb, Booking.com, and VRBO. Whenever these platforms fetch your master feed, they will see blocks created by all other channels.

## What Usually Goes Wrong

Automating calendar syncs looks straightforward until real-world edge cases hit. Here are the three most common points of failure.

### 1. Checkout Day Overlaps (The Checkout/Check-in Trap)
If Guest A checks out on April 15th, and Guest B checks in on April 15th, your system must not report a conflict. 

If your SQL query uses simple `<=` and `>=` logic, it will flag April 15th as double-booked. Always use strict `<` for check-in and `>` for check-out comparisons:
`check_in < NEW_CHECK_OUT AND check_out > NEW_CHECK_IN`
This allows one guest to leave at 11:00 AM and the next to arrive at 3:00 PM on the same date.

### 2. Blind Reliance on iCal Update Frequencies
iCal is not instantaneous. Airbnb can take 15 to 30 minutes to fetch your master n8n feed. If a guest attempts to book directly while an OTA has just taken a booking, your system will not see it via iCal yet.

To mitigate this, always enforce instant manual or API locks for high-value direct transactions, and set your n8n polling frequency for external iCals to no longer than 5 minutes.

### 3. Duplicate Records from Sync Loops
If Airbnb reads your master iCal feed and imports a direct booking block, it may export that block back out as "Airbnb Reserved". If your n8n workflow ingests that block without checking summaries, it creates a duplicate record or an indefinite loop.

Filter out external iCal entries whose summary or UID matches blocks originally generated by your own system.

## The Honest Catch

Using n8n and iCal feeds gives you 95% of the power of a paid channel manager for zero software licensing cost. However, iCal protocol limitations mean you cannot sync dynamic daily pricing or minimum stay rules—only date availability.

If you change your night rate on Booking.com, you still have to change it on Airbnb manually unless you upgrade to full API access via a PMS. But for preventing the nightmare of two guests showing up at the same door with valid keys, a lightweight database and an n8n pipeline is all you need.
