import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import prisma from "../lib/prisma.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: Redis | null = null;
let connected = false;

async function getRedis(): Promise<Redis | null> {
  if (redisClient) return redisClient;
  try {
    const r = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
    r.on("error", () => {}); // suppress unhandled error crashes
    await r.connect();
    redisClient = r;
    connected = true;
    return r;
  } catch {
    return null;
  }
}

type JobData = { documentId: string };

const inMemoryJobs = new Map<string, { data: JobData; status: string }>();
let inMemoryProcessing = false;

export async function addToQueue(documentId: string): Promise<void> {
  const conn = await getRedis();
  if (conn && connected) {
    const q = new Queue<JobData>("document-processing", { connection: conn as any });
    await q.add("process-document", { documentId });
  } else {
    inMemoryJobs.set(documentId, { data: { documentId }, status: "waiting" });
    processInMemory();
  }
}

async function processInMemory(): Promise<void> {
  if (inMemoryProcessing) return;
  inMemoryProcessing = true;

  while (true) {
    let found = false;
    for (const [id, job] of inMemoryJobs) {
      if (job.status !== "waiting") continue;
      found = true;
      job.status = "processing";
      await processDocument(id);
      job.status = "done";
      break;
    }
    if (!found) break;
  }

  inMemoryProcessing = false;
}

async function processDocument(documentId: string): Promise<void> {
  await prisma.document.update({ where: { id: documentId }, data: { status: "PROCESSING" } });

  try {
    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000";
    const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:4000";

    const res = await fetch(`${ML_ENGINE_URL}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, callbackUrl: `${GATEWAY_URL}/internal/documents/callback` }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`ML Engine error: ${res.status} — ${errBody}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await prisma.document.update({ where: { id: documentId }, data: { status: "FAILED", errorMessage: msg } });
  }
}

export async function startWorker(): Promise<void> {
  const conn = await getRedis();
  if (!conn || !connected) {
    console.log("BullMQ worker: Redis unavailable, using in-memory queue");
    return;
  }

  const worker = new Worker<JobData>("document-processing", async (job) => {
    await processDocument(job.data.documentId);
    return { success: true };
  }, { connection: conn as any });

  worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
  console.log("BullMQ worker started");
}
