import { connectDB } from "./database/config.js";
import Event from "./database/models/event.model.js";

const OLD_UNIQUE_INDEX_NAME = "partnerName_1_eventId_1";
const NEW_UNIQUE_INDEX_SPEC = {
    partnerName: 1,
    operatingMode: 1,
    eventId: 1
};

const ensureEventIndexes = async () => {
    await connectDB();

    const collection = Event.collection;
    const indexes = await collection.indexes();
    const oldIndex = indexes.find((index) => index.name === OLD_UNIQUE_INDEX_NAME);

    if (oldIndex) {
        console.log(`[migrate:event-indexes] Dropping legacy index ${OLD_UNIQUE_INDEX_NAME}`);
        await collection.dropIndex(OLD_UNIQUE_INDEX_NAME);
    }

    console.log("[migrate:event-indexes] Creating compound unique index on partnerName + operatingMode + eventId");
    await collection.createIndex(NEW_UNIQUE_INDEX_SPEC, {
        unique: true,
        name: "partnerName_1_operatingMode_1_eventId_1"
    });

    console.log("[migrate:event-indexes] Event index migration completed successfully");
    process.exit(0);
};

ensureEventIndexes().catch((error) => {
    console.error("[migrate:event-indexes] failed:", error.message);
    process.exit(1);
});
