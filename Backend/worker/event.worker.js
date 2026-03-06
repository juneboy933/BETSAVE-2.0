import { Worker } from 'bullmq';
import { processEvent } from '../service/processEvent.service.js';
import { webhookQueue } from './queues.js';
import redisConnection from './config.js';
import { connectDB } from '../database/config.js'

process.on("uncaughtException", (err) => {
    console.error("event-worker uncaughtException:", err.message);
});

process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error("event-worker unhandledRejection:", message);
});

await connectDB();
console.log("event-worker connected and waiting for jobs on event-processing-queue");

const eventWorker = new Worker(
    'event-processing-queue',
    async (job) => {
        const { eventId, partnerName, operatingMode } = job.data;

        const result = await processEvent(eventId, partnerName, operatingMode);

        if (result?.notifyPartner !== false) {
            // Queue webhook job without crashing event processing if enqueue fails.
            try {
                await webhookQueue.add('send-webhook', {
                    eventId,
                    partnerName,
                    result
                }, {
                    jobId: `webhook-${partnerName}-${eventId}`,
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 10000 },
                    removeOnComplete: true,
                    removeOnFail: false
                });
            } catch (error) {
                console.error("Failed to enqueue webhook job:", error.message);
            }
        }

        return result;
    },
    { connection: redisConnection, concurrency: 10 }
);

eventWorker.on('completed', (job) => console.log(`[${job.name}] completed`, job.id));
eventWorker.on('active', (job) => console.log(`[${job.name}] active`, job.id));
eventWorker.on('failed', (job, err) => console.error(`[${job?.name}] failed`, job?.id, err.message));
eventWorker.on("error", (err) => console.error("event-worker error:", err.message));
