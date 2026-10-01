import { Worker } from "node:worker_threads";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerTaskScriptPath = path.join(__dirname, "plagiarismWorkerTask.js");

/**
 * Execute a CPU-bound plagiarism calculation task in a dedicated Worker Thread.
 *
 * This isolates heavy MinHash estimations and 5-word shingle Set comparisons
 * from the main Node.js event loop, preventing HTTP server freezes.
 */
export const runPlagiarismWorkerTask = (taskPayload) => {
  return new Promise((resolve, reject) => {
    let worker = null;
    try {
      worker = new Worker(workerTaskScriptPath);

      worker.on("message", (response) => {
        worker.terminate().catch(() => {});
        if (response && response.status === "SUCCESS") {
          resolve(response);
        } else {
          reject(new Error(response?.error || "Worker thread processing failed."));
        }
      });

      worker.on("error", (err) => {
        worker.terminate().catch(() => {});
        reject(err);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Plagiarism worker thread exited unexpectedly with code ${code}.`));
        }
      });

      worker.postMessage(taskPayload);
    } catch (err) {
      if (worker) worker.terminate().catch(() => {});
      reject(err);
    }
  });
};

export default runPlagiarismWorkerTask;
