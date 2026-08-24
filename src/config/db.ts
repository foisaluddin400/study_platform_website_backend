import mongoose from "mongoose";
import { env } from "./env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Global connection caching across serverless invocations (Vercel)
let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export const connectDB = async (): Promise<typeof mongoose> => {
  // 1. If connection already open and ready, return existing instance immediately
  if (mongoose.connection.readyState === 1 && cached.conn) {
    return cached.conn;
  }

  // 2. If connection is in progress, await the existing promise
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: true,
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
    };

    console.log("🔌 Connecting to MongoDB Atlas Cluster0...");

    cached.promise = mongoose
      .connect(env.mongoUri, opts)
      .then((m) => {
        console.log(`✅ MongoDB Connected: ${m.connection.host} / ${m.connection.name}`);
        cached.conn = m;
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        cached.conn = null;
        console.error("❌ MongoDB connection error:", err.message || err);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. Attempting reconnection on next request...");
  if (cached) {
    cached.conn = null;
    cached.promise = null;
  }
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection runtime error:", err);
});

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    cached.conn = null;
    cached.promise = null;
    console.log("🛑 MongoDB connection closed.");
  }
};
