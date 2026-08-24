import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async (): Promise<typeof mongoose | null> => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);
    return conn;
  } catch (error: any) {
    console.warn(`⚠️ MongoDB connection warning: ${error.message || error}`);
    if (env.nodeEnv === "production") {
      process.exit(1);
    }
    return null;
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. Attempting reconnection...");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection runtime error:", err);
});

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log("🛑 MongoDB connection closed.");
  }
};
