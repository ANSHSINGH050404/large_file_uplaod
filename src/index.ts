import express,  { type Request, type Response } from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import morgan from "morgan";
const app = express();
const PORT = 3000;

 
// ─── Directories ────────────────────────────────────────────────────────────
const CHUNKS_DIR = path.join(__dirname, "../uploads/chunks");
const FINAL_DIR = path.join(__dirname, "../uploads/final");
const PUBLIC_DIR = path.join(__dirname, "../public");
[CHUNKS_DIR, FINAL_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));


// ─── In-memory state ─────────────────────────────────────────────────────────
interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  hash: string;
  createdAt: number;
  status: "uploading" | "assembling" | "transcoding" | "distributing" | "complete" | "error";
  progress: {
    upload: number;       // 0-100
    transcode: number;    // 0-100
    distribute: number;   // 0-100
  };
  variants: string[];
  cdnUrls: string[];
  errorMsg?: string;
}
 
const sessions = new Map<string, UploadSession>();


// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use(morgan("dev"));
 
// ─── Multer: store raw chunk buffer ──────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });



// 1. INIT: client announces upload intent
app.post("/api/upload/init", (req: Request, res: Response) => {
  const { fileName, fileSize, totalChunks, hash } = req.body;
 
  if (!fileName || !fileSize || !totalChunks) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
 
  const uploadId = uuidv4(); //ojoijio$^&TF
  const session: UploadSession = {
    uploadId,
    fileName,
    fileSize,
    totalChunks,
    receivedChunks: new Set(),
    hash: hash || "",
    createdAt: Date.now(),
    status: "uploading",
    progress: { upload: 0, transcode: 0, distribute: 0 },
    variants: [],
    cdnUrls: [],
  };
 
  sessions.set(uploadId, session);
 
  // Create chunk directory for this session
  fs.mkdirSync(path.join(CHUNKS_DIR, uploadId), { recursive: true });
 
  console.log(`[INIT] ${uploadId} — ${fileName} (${totalChunks} chunks)`);
  res.json({ uploadId, message: "Upload session initialized" });
});


// 2. CHUNK: receive individual chunk
app.post("/api/upload/chunk", upload.single("chunk"), (req: Request, res: Response) => {
  const { uploadId, chunkIndex, totalChunks } = req.body;
 
  if (!uploadId || chunkIndex === undefined || !req.file) {
    res.status(400).json({ error: "Missing uploadId, chunkIndex, or chunk data" });
    return;
  }
 
  const session = sessions.get(uploadId);
  if (!session) {
    res.status(404).json({ error: "Upload session not found" });
    return;
  }
 
  const idx = parseInt(chunkIndex, 10);
  const chunkPath = path.join(CHUNKS_DIR, uploadId, `chunk_${idx.toString().padStart(5, "0")}`);
 
  // Write chunk to disk
  fs.writeFileSync(chunkPath, req.file.buffer);
  session.receivedChunks.add(idx);
 
  const received = session.receivedChunks.size;
  session.progress.upload = Math.round((received / session.totalChunks) * 100);
 
  console.log(`[CHUNK] ${uploadId} — ${idx + 1}/${session.totalChunks} (${session.progress.upload}%)`);
 
  // If all chunks received, start assembly pipeline
  if (received === session.totalChunks) {
    session.status = "assembling";
    // Fire and forget — non-blocking
    assemblePipeline(uploadId).catch((err) => {
      const s = sessions.get(uploadId);
      if (s) {
        s.status = "error";
        s.errorMsg = err.message;
      }
    });
  }
 
  res.json({
    received: idx,
    totalReceived: received,
    uploadProgress: session.progress.upload,
    status: session.status,
  });
});


// 3. STATUS: poll for pipeline progress
app.get("/api/upload/status/:uploadId", (req: Request, res: Response) => {
  const uploadId = req.params.uploadId as string;
  const session = sessions.get(uploadId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
 
  res.json({
    uploadId: session.uploadId,
    fileName: session.fileName,
    status: session.status,
    progress: session.progress,
    receivedChunks: session.receivedChunks.size,
    totalChunks: session.totalChunks,
    variants: session.variants,
    cdnUrls: session.cdnUrls,
    errorMsg: session.errorMsg,
  });
});
 
// 4. LIST active sessions
app.get("/api/sessions", (_req: Request, res: Response) => {
  const list = Array.from(sessions.values()).map((s) => ({
    uploadId: s.uploadId,
    fileName: s.fileName,
    status: s.status,
    progress: s.progress,
    createdAt: s.createdAt,
  }));
  res.json(list.sort((a, b) => b.createdAt - a.createdAt));
});
 
// ─── Pipeline ────────────────────────────────────────────────────────────────
 
async function assemblePipeline(uploadId: string) {
  const session = sessions.get(uploadId)!;
  
  // ── ASSEMBLE ──
  console.log(`[ASSEMBLE] ${uploadId} — sewing ${session.totalChunks} chunks`);
  const finalPath = path.join(FINAL_DIR, `${uploadId}_${session.fileName}`);
  const writeStream = fs.createWriteStream(finalPath);
 
  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = path.join(CHUNKS_DIR, uploadId, `chunk_${i.toString().padStart(5, "0")}`);
    const data = fs.readFileSync(chunkPath);
    writeStream.write(data);
  }
 
  await new Promise<void>((res, rej) => {
    writeStream.end();
    writeStream.on("finish", res);
    writeStream.on("error", rej);
  });
 
  // Compute hash of assembled file
  const fileBuffer = fs.readFileSync(finalPath);
  const computedHash = createHash("sha256").update(fileBuffer).digest("hex").slice(0, 16);
  session.progress.upload = 100;
 
  // Clean up chunks
  fs.rmSync(path.join(CHUNKS_DIR, uploadId), { recursive: true, force: true });
  console.log(`[ASSEMBLE] ${uploadId} — complete, hash: ${computedHash}`);
 
  // ── TRANSCODE ──
  session.status = "transcoding";
  const variants = ["2160p (4K)", "1080p (H.264)", "720p (VP9)", "480p (H.264)", "360p (VP9)"];
  
  for (let i = 0; i < variants.length; i++) {
    // Simulate transcoding time proportional to resolution
    const delays = [1200, 900, 700, 500, 400];
    const delay = delays[i] || 500;
    const variant = variants[i] || "unknown";
    
    await sleep(delay);
    session.variants.push(variant);
    session.progress.transcode = Math.round(((i + 1) / variants.length) * 100);
    console.log(`[TRANSCODE] ${uploadId} — ${variant} done`);
  }
 
  // ── DISTRIBUTE ──
  session.status = "distributing";
  const cdnEdges = [
    "cdn-us-east-1.example.com",
    "cdn-eu-west-2.example.com",
    "cdn-ap-south-1.example.com",
    "cdn-us-west-2.example.com",
  ];
 
  for (let i = 0; i < cdnEdges.length; i++) {
    await sleep(300);
    session.cdnUrls.push(`https://${cdnEdges[i]}/${uploadId}/manifest.m3u8`);
    session.progress.distribute = Math.round(((i + 1) / cdnEdges.length) * 100);
    console.log(`[CDN] ${uploadId} — distributed to ${cdnEdges[i]}`);
  }
 
  session.status = "complete";
  console.log(`[DONE] ${uploadId} — pipeline complete`);
}
 
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}




app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
