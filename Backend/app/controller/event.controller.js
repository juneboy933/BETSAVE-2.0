import { ingestEvent } from "../../service/ingestEvent.service.js";
import { eventQueue } from "../../worker/queues.js";

export const postEvent = async (req, res) => {
    try {
        const { eventId, phone, amount, type } = req.body;

        if (!req.partner) return res.status(401).json({ status: "FAILED", reason: "Partner not authenticated" });

        const partnerName = req.partner.name;

        // Validation
        if (!eventId || !phone || amount === undefined) return res.status(400).json({ status: 'FAILED', reason: 'Event Id, phone or amount missing' });
        if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ status: 'FAILED', reason: 'Invalid amount' });

        const ingestResult = await ingestEvent({ eventId, phone, partnerName, type, amount });

        if (ingestResult.status === 'FAILED') return res.status(400).json(ingestResult);
        if (ingestResult.status === 'SKIPPED') return res.status(200).json(ingestResult);

        // Queue the event
        await eventQueue.add('process-event', 
            { eventId, partnerName },
            {
                jobId: `${partnerName}-${eventId}`,
                attempts: 5,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: false
            }
        );

        return res.status(200).json({ status: 'RECEIVED', eventId });

    } catch (error) {
        console.error("postEvent error:", error.message);
        return res.status(500).json({ status: "FAILED", reason: "Internal server error" });
    }
};