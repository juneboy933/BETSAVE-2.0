import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    throw new Error("MONGO_URI is not defined in environment variables.");
}

export const connectDB = async () => {
    try {
        await mongoose.connect(mongoUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });

        console.log("Database connected successfully");

        mongoose.connection.on("disconnected", () => {
            console.error("MongoDB disconnected");
        });

        mongoose.connection.on("reconnected", () => {
            console.log("MongoDB reconnected");
        });

        return mongoose.connection;

    } catch (error) {
        console.error("Error connecting to database:", error.message);
        process.exit(1);
    }
};