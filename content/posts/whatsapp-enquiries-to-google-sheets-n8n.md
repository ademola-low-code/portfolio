---
title: How to connect WhatsApp enquiries to Google Sheets with n8n
description: Every WhatsApp enquiry logged to a spreadsheet automatically, with no copy-paste — the exact workflow, the three mistakes that break it, and how to keep it running.
date: 2026-11-23
category: n8n & Integrations
tags: [n8n, whatsapp, google sheets, lead capture]
---

If your business takes enquiries on WhatsApp, you already know the problem. Someone messages at 11pm asking about availability. By morning it's buried under forty other chats, and nobody remembers whether it was answered.

The fix is small: every incoming message writes itself to a spreadsheet, so you have one list you can sort, filter and follow up. Here's exactly how to build it.

## What you need

- A WhatsApp Business account connected to the **WhatsApp Cloud API** (free to set up through Meta)
- An n8n instance — cloud or self-hosted
- A Google account

That's it. No paid tools.

## The workflow, node by node

**1. Webhook (trigger).** In n8n, add a Webhook node set to `POST` and copy its production URL. This is the address Meta will send every message to.

**2. Point Meta at it.** In your Meta app, under WhatsApp → Configuration, paste the webhook URL, set a verify token, and subscribe to the `messages` field. Meta sends a one-time verification request, so your webhook has to answer it before it will accept real traffic.

**3. Normalise the message.** WhatsApp's payload is deeply nested and changes shape depending on message type. Add a Code node that pulls out only what you need:

```javascript
const entry = $json.body.entry?.[0];
const value = entry?.changes?.[0]?.value;
const msg   = value?.messages?.[0];

if (!msg) return [];               // status callbacks, not messages

return [{
  json: {
    name:      value.contacts?.[0]?.profile?.name || 'Unknown',
    phone:     msg.from,
    message:   msg.text?.body || `[${msg.type}]`,
    type:      msg.type,
    received:  new Date(Number(msg.timestamp) * 1000).toISOString()
  }
}];
```

**4. Append to Google Sheets.** Add a Google Sheets node, operation **Append Row**. Create a sheet with the columns `Received`, `Name`, `Phone`, `Message`, `Type`, `Status`, and map each field manually. Set `Status` to a fixed value of `New`.

**5. Reply instantly (optional, but do it).** Add a WhatsApp node that sends a short acknowledgement: *"Thanks — we've got your message and will reply shortly."* An enquiry that gets an instant reply is far less likely to go to a competitor while you sleep.

Activate the workflow. Message your own number. The row should appear in under two seconds.

## Three things that break it

**Status callbacks flooding your sheet.** Meta sends an event every time a message is delivered or read, not only when one arrives. Without the `if (!msg) return []` guard in step 3, you'll get hundreds of blank rows a day. This is the single most common mistake.

**Automatic column mapping.** It's tempting to let n8n map fields for you. Don't. WhatsApp payloads vary by message type, and automatic mapping quietly writes the wrong value into the wrong column when someone sends an image instead of text. Map every column by hand once and it stays correct.

**Duplicate rows on retries.** If your workflow errors after the Sheets node, Meta retries the whole delivery and you get the row twice. Keep the append step last, or check for an existing row with the same message ID before writing.

## Where it goes next

Once enquiries are landing in a sheet, the useful part becomes obvious:

- Route by keyword — "price" goes to sales, "complaint" goes straight to a Telegram alert
- Score each enquiry with an AI node and flag only the serious ones
- Push qualified leads into your CRM instead of the sheet
- Let an AI agent answer the common questions outright, so only the real conversations reach a human

That last step is the one most businesses actually want. The spreadsheet is the foundation it stands on.

## One honest caveat

The WhatsApp Cloud API has a 24-hour messaging window: outside it, you can only send pre-approved template messages. If your follow-up happens days later, build it around templates from the start rather than discovering the limit when a reply silently fails.
