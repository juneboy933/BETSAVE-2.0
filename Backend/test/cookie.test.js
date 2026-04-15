import test from "node:test";
import assert from "node:assert/strict";

import { buildClearedSessionCookie, buildSessionCookie } from "../app/http/cookie.js";

test("session cookies default to SameSite=Lax outside production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    try {
        const cookie = buildSessionCookie({
            name: "betsave_partner_session",
            value: "token",
            maxAgeSeconds: 60
        });

        assert.match(cookie, /SameSite=Lax/);
        assert.doesNotMatch(cookie, /Secure/);
    } finally {
        process.env.NODE_ENV = originalNodeEnv;
    }
});

test("session cookies use SameSite=None and Secure in production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
        const cookie = buildSessionCookie({
            name: "betsave_partner_session",
            value: "token",
            maxAgeSeconds: 60
        });
        const clearedCookie = buildClearedSessionCookie("betsave_partner_session");

        assert.match(cookie, /SameSite=None/);
        assert.match(cookie, /Secure/);
        assert.match(clearedCookie, /SameSite=None/);
        assert.match(clearedCookie, /Secure/);
    } finally {
        process.env.NODE_ENV = originalNodeEnv;
    }
});
