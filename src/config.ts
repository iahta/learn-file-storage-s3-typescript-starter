import { newDatabase } from "./db/db";
import type { Database } from "bun:sqlite";
import { s3, S3Client } from "bun";

export type ApiConfig = {
  db: Database;
  jwtSecret: string;
  platform: string;
  filepathRoot: string;
  assetsRoot: string;
  tempRoot: string;
  s3Client: S3Client;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretAccessKey: string;
  s3CfDistribution: string;
  port: string;
};

const pathToDB = envOrThrow("DB_PATH");
const jwtSecret = envOrThrow("JWT_SECRET");
const platform = envOrThrow("PLATFORM");
const filepathRoot = envOrThrow("FILEPATH_ROOT");
const assetsRoot = envOrThrow("ASSETS_ROOT");
const tempRoot = envOrThrow("TEMP_ROOT");
const s3Bucket = envOrThrow("S3_BUCKET");
const s3Region = envOrThrow("S3_REGION");
const s3CfDistribution = envOrThrow("S3_CF_DISTRO");
const s3AccessKey = envOrThrow("AWS_ACCESS_KEY_ID");
const s3SecretAccessKey = envOrThrow("AWS_SECRET_ACCESS_KEY");
const port = envOrThrow("PORT");
const s3Client = new Bun.S3Client();

const db = newDatabase(pathToDB);

export const cfg: ApiConfig = {
  db: db,
  jwtSecret: jwtSecret,
  platform: platform,
  filepathRoot: filepathRoot,
  assetsRoot: assetsRoot,
  tempRoot: tempRoot,
  s3Client: s3Client,
  s3Bucket: s3Bucket,
  s3Region: s3Region,
  s3AccessKey: s3AccessKey,
  s3SecretAccessKey: s3SecretAccessKey,
  s3CfDistribution: s3CfDistribution,
  port: port,
};

function envOrThrow(key: string) {
  const envVar = process.env[key];
  if (!envVar) {
    throw new Error(`${key} must be set`);
  }
  return envVar;
}
