import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000").transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/study_abroad_platform"),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET should be at least 16 characters long")
    .default("super_secret_jwt_key_study_abroad_platform_2026"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET should be at least 16 characters long")
    .default("super_secret_refresh_jwt_key_study_abroad_platform_2026"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000,http://localhost:5173"),
  CLIENT_URL: z.string().trim().default("http://localhost:3000"),
  EMAIL_USER: z.string().trim().optional().default(""),
  EMAIL_PASSWORD: z.string().trim().optional().default(""),
  SMTP_HOST: z.string().trim().optional().default(""),
  SMTP_PORT: z
    .string()
    .trim()
    .default("587")
    .transform((val) => parseInt(val, 10)),
  SMTP_SECURE: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val !== undefined ? val === "true" || val === "1" : undefined)),
  SMTP_USER: z.string().trim().optional().default(""),
  SMTP_PASS: z.string().trim().optional().default(""),
  SMTP_SERVICE: z.string().trim().optional().default(""),
  EMAIL_FROM: z.string().trim().default("no-reply@abroadpath.com"),
  EMAIL_FROM_NAME: z.string().trim().default("AbroadPath OS"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables configuration:", parsedEnv.error.format());
  process.exit(1);
}

const raw = parsedEnv.data;

const resolvedSmtpPort = raw.SMTP_PORT || 587;
const resolvedSmtpSecure =
  raw.SMTP_SECURE !== undefined ? raw.SMTP_SECURE : resolvedSmtpPort === 465;

export interface AppEnv {
  port: number;
  nodeEnv: "development" | "production" | "test";
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  corsOrigin: string;
  clientUrl: string;
  emailUser: string;
  emailPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpService?: string;
  emailFrom: string;
  emailFromName: string;
}

export const env: AppEnv = {
  port: raw.PORT,
  nodeEnv: raw.NODE_ENV,
  mongoUri: raw.MONGO_URI,
  jwtSecret: raw.JWT_SECRET,
  jwtExpiresIn: raw.JWT_EXPIRES_IN,
  jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN,
  corsOrigin: raw.CORS_ORIGIN,
  clientUrl: raw.CLIENT_URL,
  emailUser: (raw.SMTP_USER || raw.EMAIL_USER || "").trim(),
  emailPassword: (raw.SMTP_PASS || raw.EMAIL_PASSWORD || "").trim(),
  smtpHost: (raw.SMTP_HOST || "").trim(),
  smtpPort: resolvedSmtpPort,
  smtpSecure: resolvedSmtpSecure,
  smtpService: (raw.SMTP_SERVICE || "").trim() || undefined,
  emailFrom: (raw.EMAIL_FROM || "").trim(),
  emailFromName: (raw.EMAIL_FROM_NAME || "").trim(),
};
