import { respondWithJSON } from "./json";
import { BadRequestError, UserForbiddenError, NotFoundError } from "./errors";
import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { getVideoType, getVideoTempPath, uploadVideoToS3 } from "./assets";
import { rm } from "fs/promises";

const MAX_UPLOAD_SIZE = (1 << 30)

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
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

  const formData = await req.formData()
  const video_file = formData.get("video")
  if (!(video_file instanceof File)) {
    throw new BadRequestError("Invalid file")
  }
  if (video_file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Video exceeds max file size")
  }

  const media_type = video_file.type
  if (!media_type) {
    throw new BadRequestError("Missing Content-Type for thumbnail")
  }

  const file_ext = getVideoType(media_type);
  const tempFilePath = getVideoTempPath(cfg, `${videoId}${file_ext}`);
  await Bun.write(tempFilePath, video_file);

  const aspectRatio = await getVideoAspectRatio(tempFilePath)
  const processedVideo = await processVideoForFastStart(tempFilePath)
  let key = `${aspectRatio}/${videoId}${file_ext}`;
  await uploadVideoToS3(cfg, key, processedVideo, "video/mp4");

  //const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
  const videoURL = `https://${cfg.s3CfDistribution}/${key}`
  video_meta.videoURL = videoURL;
  updateVideo(cfg.db, video_meta)
  

  await Promise.all([rm(tempFilePath, { force: true})]);
  await Promise.all([rm(processedVideo, { force: true})]);


  return respondWithJSON(200, null);
}

async function getVideoAspectRatio(filePath: string) {
  const proc = Bun.spawn(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", filePath], {
    stderr: "pipe",
    stdout: "pipe",
  });

  const [output, errors ] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new BadRequestError("Failed to get metadata of video")
  }

  const { streams } = JSON.parse(output);
  const { width, height} = streams[0];
  if (!width || !height) {
    throw new BadRequestError("Invalid width/height data");
  }

  const aspectRatio = width / height;

  const TOLERANCE = 0.05;
  const LANDSCAPE = 16 / 9;
  const PORTRAIT = 9 / 16;


  if (Math.abs(aspectRatio - LANDSCAPE) < TOLERANCE) return "landscape";
  if (Math.abs(aspectRatio - PORTRAIT) < TOLERANCE) return "portrait";
  return "other";
}

async function processVideoForFastStart(inputFilePath: string) {
  const outputFilePath = inputFilePath + ".processed"

  const proc = Bun.spawn([
    "ffmpeg", 
    "-i", inputFilePath, 
    "-movflags", "faststart", 
    "-map_metadata", "0", 
    "-codec", "copy",
    "-f", "mp4",
    outputFilePath,
  ])

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new BadRequestError("Failed to get process faststart of video")
  }

  return outputFilePath;
  
}