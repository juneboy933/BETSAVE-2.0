import { Worker } from 'bullmq';
import { sendpartnerWebhook } from '../service/notifyPartner.service.js';
import redisConnection from './config.js';
import { connectDB } from '../database/config.js';

await connectDB();

const webhookWorker = new Worker(
    'partner-webhook-queue',
    async (job) => {
        const { partnerName, result, eventId } = job.data;

        // Minimal payload for partner
        const payload = result.status === 'PROCESSED'
            ? { eventId, status: 'PROCESSED', savingsAmount: result.savingsAmount }
            : { eventId, status: 'FAILED', reason: result.reason };

        await sendpartnerWebhook({ partnerName, payload });
    },
    { connection: redisConnection, concurrency: 20 }
);

webhookWorker.on('completed', (job) => console.log(`[${job.name}] completed`, job.id));

webhookWorker.on('failed', (job, err) => {
    console.error(`[${job?.name}] failed`, job?.id, err.message);
    if (job.attemptsMade === job.opts.attempts) {
        console.error('PERMANENT FAILURE', { jobId: job.id, partnerName: job.data.partnerName, eventId: job.data.eventId });
    }
});
