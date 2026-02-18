import { Worker } from 'bullmq';
import { processEvent } from '../service/processEvent.service.js';
import { webhookQueue } from './queues.js';
import redisConnection from './config.js';
import { connectDB } from '../database/config.js'

await connectDB();

const eventWorker = new Worker(
    'event-processing-queue',
    async (job) => {
        const { eventId, partnerName } = job.data;

        const result = await processEvent(eventId, partnerName);

        // Queue webhook job
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

        return result;
    },
    { connection: redisConnection, concurrency: 10 }
);

eventWorker.on('completed', (job) => console.log(`[${job.name}] completed`, job.id));
eventWorker.on('failed', (job, err) => console.error(`[${job?.name}] failed`, job?.id, err.message));