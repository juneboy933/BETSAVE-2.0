# Integration Guide

This guide is for partner backend teams and operators integrating with Betsave 2.0.

## Core Rules

- Betsave processes only `BET_PLACED` partner events.
- Production partner writes must come from a backend service, not browser code.
- In `live` mode, partner write actions require signed integration authentication plus `x-integration-token`.
- Dashboard access uses the partner/admin session cookie.
- Keep `apiKey`, `apiSecret`, callback secrets, and admin session material out of frontend code.

## Partner Registration

1. Register the partner from the partner portal with email and password.
2. Save the one-time `apiKey` and `apiSecret` immediately in your backend secret manager.
3. Configure a real HTTPS webhook before switching the partner to `live`.

## Signed Partner Requests

Required headers:

- `x-api-key`
- `x-timestamp`
- `x-signature`

`x-timestamp` must be the current Unix time in milliseconds and must be within 5 minutes of the server clock.

Signature payload format:

```text
{timestamp}{HTTP_METHOD}{REQUEST_PATH}{JSON_BODY}
```

Example payload for `POST /api/v1/partners/events`:

```text
1710000000000POST/api/v1/partners/events{"eventId":"BET-123","phone":"+254700000000","amount":250,"type":"BET_PLACED"}
```

Generate the signature with HMAC-SHA256 using the partner `apiSecret`.

Node.js example:

```js
import crypto from "crypto";

const timestamp = Date.now().toString();
const method = "POST";
const path = "/api/v1/partners/events";
const body = {
  eventId: "BET-123",
  phone: "+254700000000",
  amount: 250,
  type: "BET_PLACED"
};

const payload = `${timestamp}${method}${path}${JSON.stringify(body)}`;
const signature = crypto
  .createHmac("sha256", process.env.BETSAVE_PARTNER_API_SECRET)
  .update(payload)
  .digest("hex");
```

## Live-Mode Protection

When a partner is in `live` mode, these write endpoints also require:

- `x-integration-token`

Protected write endpoints:

- `POST /api/v1/partners/events`
- `POST /api/v1/partners/users/register`
- `POST /api/v1/partners/users/verify-otp`
- `POST /api/v1/partners/users/:userId/withdrawals`

## Partner Event API

Endpoint:

- `POST /api/v1/partners/events`

Body:

```json
{
  "eventId": "BET-123",
  "phone": "+254700000000",
  "amount": 250,
  "type": "BET_PLACED"
}
```

Notes:

- `phone` must be in `+254XXXXXXXXX` format.
- `amount` must be positive.
- `type` must be `BET_PLACED`.
- Event processing is asynchronous. Submission success is not final payment success.

## Partner User APIs

Endpoints:

- `POST /api/v1/partners/users/register`
- `POST /api/v1/partners/users/verify-otp`
- `POST /api/v1/partners/users/:userId/withdrawals`

Use these from a trusted partner backend in live mode.

### Partner-Initiated Withdrawals

Endpoint:

- `POST /api/v1/partners/users/:userId/withdrawals`

Body:

```json
{
  "phone": "+254700000000",
  "amount": 250,
  "idempotencyKey": "partner-wd-20260320-001",
  "notes": "User wallet withdrawal"
}
```

Rules:

- `userId` must belong to a partner-linked user for the authenticated partner.
- If `phone` is provided, it must match the linked partner user phone.
- `idempotencyKey` is required and must be unique per withdrawal attempt.
- Betsave records partner attribution on the withdrawal so both partner and admin dashboards can trace who initiated it.
- In `live` mode, the same signed partner auth and `x-integration-token` rules apply.

Withdrawal policy:

- Demo withdrawals can proceed whenever the partner-attributed wallet balance is sufficient.
- Live withdrawals are blocked until the user has at least `KES 100` available and has had live auto-savings enabled for the configured maturity window.
- Betsave logs both allowed and blocked withdrawal policy decisions for auditability.

## Daraja and Payment Callbacks

Betsave creates signed callback URLs for Daraja internally using `PAYMENT_CALLBACK_TOKEN`.

You do not need to sign Daraja callbacks yourself, but you do need to:

- configure callback base URLs in backend env
- use HTTPS in production
- monitor callback failures and stale pending work in the admin operations dashboard

## Settlement and Reconciliation

Successful Paybill collection is not the same thing as final bank settlement.

Current flow:

1. Daraja confirms the collection callback.
2. Betsave marks the deposit successful.
3. Real live deposits remain `settlementStatus=PENDING` until reconciled.
4. Reconciliation posts funds from `MPESA_COLLECTION` to `BANK_SETTLEMENT`.

Admin reconciliation endpoint:

- `POST /api/v1/dashboard/admin/operations/reconciliation-runs`

Use this for finance-imported settlement batches or controlled live/demo testing.

## Dashboard Expectations

Partner dashboard:

- uses the partner session cookie from login
- shows scoped demo/live status
- shows partner-scoped withdrawal policy, withdrawal transactions, and withdrawal trace logs in the demo walkthrough
- is an operator view, not an integration surface

Admin dashboard:

- uses the admin session cookie
- has a mode switch for `demo` and `live`
- operations view is the main place to watch stale events, pending payments, unsettled deposits, recent withdrawals, and reconciliation runs

## Production Launch Minimums

Before real-money launch, make sure all of these are true:

- `MONGO_REQUIRE_TRANSACTIONS=true`
- MongoDB runs as a replica set or through mongos
- `CORS_ALLOWED_ORIGINS` is explicitly set
- admin and partner frontends are behind HTTPS
- `PAYMENT_CALLBACK_TOKEN` is set
- `BANK_SETTLEMENT_ACCOUNT` is set
- `PARTNER_INTEGRATION_TOKEN` is set for live partner writes
- Daraja live credentials and HTTPS callback URLs are configured
- B2C withdrawal credentials and HTTPS result/timeout URLs are configured
- reconciliation process is run and monitored daily
- admin MFA and secret rotation are in place before serious production exposure

## Recommended Pattern

- Browser/operator logs into Betsave dashboard with email and password
- Partner backend stores Betsave integration secrets
- Partner backend signs and sends `BET_PLACED` events
- Partner backend registers and verifies wallet users before initiating live withdrawals
- Betsave processes events and pushes terminal outcomes to the partner webhook
- Betsave records structured logs for deposits, withdrawals, callbacks, reconciliation, and recovery activity

If your browser app is sending signed partner writes directly, that design is weak and should be replaced.
