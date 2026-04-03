export class ProcessService {

  static async executeTask(payload: any) {
    console.log("Processing payload:", payload);

    await Bun.sleep(500); 
    return { success: true, timestamp: Date.now() };
  }
}a



