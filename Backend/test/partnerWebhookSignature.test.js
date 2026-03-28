import test from "node:test";
import assert from "node:assert/strict";

import {
    buildPartnerWebhookRequestPath,
    buildPartnerWebhookSignaturePayload
} from "../service/partnerWebhookSignature.service.js";

test("partner webhook signing uses the documented request path including query string", () => {
    assert.equal(
        buildPartnerWebhookRequestPath("https://partner.example.com/hooks/betsave?source=prod"),
        "/hooks/betsave?source=prod"
    );
});

test("partner webhook signature payload matches the documented canonical request format", () => {
    const payload = buildPartnerWebhookSignaturePayload({
        timestamp: "1710000000000",
        method: "POST",
        webhookUrl: "https://partner.example.com/hooks/betsave",
        payload: {
            eventId: "BET-123",
            status: "PROCESSED"
        }
    });

    assert.equal(
        payload,
        '1710000000000POST/hooks/betsave{"eventId":"BET-123","status":"PROCESSED"}'
    );
});
