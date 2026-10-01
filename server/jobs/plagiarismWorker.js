import { processQueuedAnalyses } from "../services/plagiarismService.js";

// Background worker for the plagiarism queue.
//
// A polling loop inside the API process rather than a separate worker with a
// broker: the volume here is a handful of scans per day, and asking a university
// deployment to run Redis alongside MySQL and the API would cost more than it
// buys. The queue is a database table, so nothing is lost if the process
// restarts mid-flight - queued rows are simply picked up on the next tick.
//
// When this needs to scale, the loop is the only thing that has to move: the
// service functions it calls are already transport-agnostic.
const DEFAULT_INTERVAL_MS = 20000;
const BATCH_SIZE = 5;

let timer = null;
let ticking = false;

export const runWorkerTick = async () => {
  // Never overlap ticks: a slow Copyleaks call must not let a second tick pick
  // up rows the first one is still working on.
  if (ticking) return { skipped: true };
  ticking = true;

  try {
    const results = await processQueuedAnalyses({ limit: BATCH_SIZE });
    if (results.length > 0) {
      console.log(`Plagiarism worker: processed ${results.length} queued analys(es)`);
    }
    return { skipped: false, results };
  } catch (error) {
    // A worker error must never take the API down.
    console.error("PLAGIARISM WORKER ERROR:", error.message);
    return { skipped: false, error: error.message };
  } finally {
    ticking = false;
  }
};

export const startPlagiarismWorker = () => {
  if (timer) return timer;

  if (String(process.env.PLAGIARISM_WORKER_ENABLED ?? "false").toLowerCase() !== "true") {
    console.log("Plagiarism worker interval polling disabled (runs on demand when analysis button is clicked).");
    return null;
  }

  const interval = Number(process.env.PLAGIARISM_WORKER_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  timer = setInterval(runWorkerTick, interval);
  // Do not hold the process open on the worker's account.
  if (typeof timer.unref === "function") timer.unref();

  console.log(`Plagiarism worker started (every ${interval} ms).`);
  return timer;
};

export const stopPlagiarismWorker = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

export default startPlagiarismWorker;
