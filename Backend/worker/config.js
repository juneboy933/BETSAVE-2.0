import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUri = process.env.REDIS_URI;

if(!redisUri){
    throw new Error('REDIS_URI is not defined in environment variables.');
}

const redisConnection = new Redis(redisUri, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
});

// await redisConnection.connect();

export default redisConnection;