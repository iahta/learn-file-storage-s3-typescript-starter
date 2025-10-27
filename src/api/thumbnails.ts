import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

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

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const parsed = await req.formData()
  const img_data = parsed.get("thumbnail")
  if (!(img_data !instanceof File)) {
    throw new BadRequestError("Invalid file")
  }
  if (img_data.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size must be below 10mb")
  }
  const media_type = img_data.type
  let buf = await img_data.arrayBuffer()
  const video_meta = getVideo(cfg.db, videoId)
  if (!video_meta) {
    throw new BadRequestError("Unable to locate video meta data")
  }
  if (video_meta.userID !== userID) {
    throw new UserForbiddenError("Video does not belong to user")
  }
  videoThumbnails.set(video_meta.id, {
    data: buf,
    mediaType: media_type,
  })
  const thumbnailURL = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`
  video_meta.thumbnailURL = thumbnailURL
  updateVideo(cfg.db, video_meta)
  console.log(video_meta.thumbnailURL)

  return respondWithJSON(200, video_meta);
}
