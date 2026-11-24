import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  MIGRATION_DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(24),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STRIPE_SECRET_KEY: z.string().optional(), STRIPE_WEBHOOK_SECRET: z.string().optional()
});
export function env(){return schema.parse(process.env);}

