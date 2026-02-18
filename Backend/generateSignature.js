import crypto from 'crypto';

const apiSecret = 'dc898ee666bbdfa62e3cc621b23375539e26be88945e55eef4137cef27a31f25';
const timestamp = Date.now();

const body = {
    "eventId": "BETCO-001",
    "phone": "+254700000000",
    "amount": 2000
};

const payload = `${timestamp}POST/api/v1/partners/events${JSON.stringify(body)}`;

const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(payload)
    .digest('hex');

console.log(signature, timestamp);