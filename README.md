# Large File Upload Service

A high-performance service built with Express and Bun for handling large file uploads and background processing tasks.

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh/) runtime installed.

### Installation
```bash
bun install
```

### Running the server
```bash
bun run src/index.ts
```
The server will start at `http://localhost:3000`.

## 🛠 Current Features
- **Express on Bun**: Utilizes Bun's high-performance runtime for Express APIs.
- **Health Monitoring**: Integrated health check endpoints.
- **Task Processing**: Initial `ProcessService` for handling asynchronous payloads.

## 📡 API Endpoints

### System
- `GET /api/v1/health` - Returns the service status and uptime.
- `POST /api/v1/trigger` - Queues a processing task.
  - **Request Body**:
    ```json
    {
      "taskId": "unique-id",
      "action": "start"
    }
    ```

## 📂 Project Structure
- `src/index.ts`: Entry point and server configuration.
- `src/routes/`: API route definitions (e.g., `systemRouter`).
- `src/services/`: Core logic and task execution services.
