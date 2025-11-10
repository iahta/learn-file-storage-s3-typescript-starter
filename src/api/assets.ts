import { existsSync, mkdirSync } from "fs";
import { BadRequestError } from "./errors";
import path from "path";
import type { ApiConfig } from "../config";

const image_types = ["jpeg", "png"];
const video_types = ["mp4"];

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export function getImageType(media_type: string) {
  const type = media_type.split("/")
  if (type.length !== 2) {
    return ".bin";
  }
  if (type[0] != "image") {
    throw new BadRequestError("Media type must be image")
  } 
  if (!image_types.includes(type[1])) {
    throw new BadRequestError("Media type must be png or jpeg")
  }
  return "." + type[1]
}

export function getVideoType(media_type: string) {
  const type = media_type.split("/")
  if (type.length !== 2) {
    throw new BadRequestError("Media type missing")
  }
  if (type[0] != "video") {
    throw new BadRequestError("Media type must be image")
  } 
  if (!video_types.includes(type[1])) {
    throw new BadRequestError("Media type must be mp4")
  }
  return "." + type[1]
}
  
export function getAssetDiskPath(cfg: ApiConfig, assetPath: string) {
  return path.join(cfg.assetsRoot, assetPath);
}

export function getVideoTempPath(cfg: ApiConfig, assetPath: string) {
  return path.join(cfg.tempRoot, assetPath)
}

export function getAssetURL(cfg: ApiConfig, assetPath: string) {
  return `http://localhost:${cfg.port}/assets/${assetPath}`;
}

export async function uploadVideoToS3(
  cfg: ApiConfig,
  key: string,
  processesFilePath: string,
  contentType: string,
) {
  const s3File = cfg.s3Client.file(key, { bucket: cfg.s3Bucket});
  const videoFile = Bun.file(processesFilePath);
  await s3File.write(videoFile, { type: contentType});
}