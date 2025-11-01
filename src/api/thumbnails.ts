import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { Buffer } from "buffer";
import { getImageType, getAssetDiskPath, getAssetURL} from "./assets";
import path from "path";
import { url } from "inspector";


type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();
const MAX_UPLOAD_SIZE = (10 << 20)

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video_meta = getVideo(cfg.db, videoId)
  if (!video_meta) {
    throw new BadRequestError("Unable to locate video meta data")
  }
  if (video_meta.userID !== userID) {
    throw new UserForbiddenError("Video does not belong to user")
  }

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData()
  const file = formData.get("thumbnail")
  if (!(file !instanceof File)) {
    throw new BadRequestError("Invalid file")
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size must be below 10mb")
  }

  const media_type = file.type
  if (!media_type) {
    throw new BadRequestError("Missing Content-Type for thumbnail")
  }

  const file_ext = getImageType(media_type);
  const filename = `${videoId}${file_ext}`;

  const assetDiskPath = getAssetDiskPath(cfg, filename);
  await Bun.write(assetDiskPath, file);

  const urlPath = getAssetURL(cfg, filename)
  video_meta.thumbnailURL = urlPath
  
  updateVideo(cfg.db, video_meta)

  return respondWithJSON(200, video_meta);
}


