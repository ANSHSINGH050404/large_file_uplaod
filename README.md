# Large File & Video Pipeline Service

A high-performance, chunk-based upload and processing engine built with **Express** and **Bun**. This service handles multi-gigabyte file uploads by splitting them into small chunks, followed by an automated pipeline for assembly, simulated transcoding, and CDN distribution.

## 🚀 Features

- **Chunk-based Resumable Uploads**: Splits files into 2MB chunks to ensure reliability.
- **Automated Pipeline**: 
  - **Assembly**: Merges chunks into the final file with integrity checks.
  - **Simulated Transcoding**: Processes files into multiple variants (4K, 1080p, etc.).
  - **CDN Distribution**: Simulates global distribution to edge locations.
- **Modern Dashboard**: Real-time progress tracking for every stage of the pipeline.
- **High Performance**: Powered by the Bun runtime for ultra-fast I/O.

## 🛠 Getting Started

### Prerequisites
- [Bun](https://bun.sh/) runtime installed.

### Installation
```bash
bun install
```

### Running the Server
```bash
# Development mode (with hot reload)
bun dev

# Production mode
bun start
```
The dashboard will be available at `http://localhost:3000`.

## 📡 API Architecture

### Upload Pipeline
- `POST /api/upload/init` - Initialize a new upload session.
- `POST /api/upload/chunk` - Upload an individual file chunk (multipart/form-data).
- `GET /api/upload/status/:uploadId` - Poll the real-time status of a specific session.
- `GET /api/sessions` - List all active and completed sessions.

### System
- `GET /health` - Basic server health check.

## 📂 Project Structure
- `src/index.ts`: Main application logic, route handlers, and pipeline implementation.
- `public/`: Frontend dashboard (HTML/Tailwind CSS).
- `uploads/`:
  - `chunks/`: Temporary storage for partial uploads.
  - `final/`: Directory for assembled and processed files.
