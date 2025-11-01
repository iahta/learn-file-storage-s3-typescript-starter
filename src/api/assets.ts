import { existsSync, mkdirSync } from "fs";
import { BadRequestError } from "./errors";
import path from "path";
import type { ApiConfig } from "../config";

const image_types = ["jpeg", "png"];

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
  
export function getAssetDiskPath(cfg: ApiConfig, assetPath: string) {
  return path.join(cfg.assetsRoot, assetPath);
}

export function getAssetURL(cfg: ApiConfig, assetPath: string) {
  return `http://localhost:${cfg.port}/assets/${assetPath}`;
}