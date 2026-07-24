import readline from "readline";
import { createAWSThread, triggerAWSRun, connectAWSStream, remoteHostLabel } from "./remote.js";
import { maskKey, type CliOptions } from "./config.js";
import { deliverArtifact } from "./delivery.js";

export async function runInteractiveCLI({ apiKey, outDir, allowAnyPath }: CliOptions) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("==================================================");
  console.log("🧠 Pinky and the Brain - Remote Agent CLI REPL");
  console.log(`Initializing session with ${remoteHostLabel()} (API Key: ${maskKey(apiKey)})...`);
  console.log("==================================================");

  let threadId: string;
  try {
    threadId = await createAWSThread(apiKey);
    console.log(`🧵 Remote Thread ID: ${threadId}`);
    console.log(`📁 Files the agent writes are saved to: ${outDir}`);
    console.log("Type your message to prompt the agent workflow.");
    console.log("Type 'exit' or 'quit' to end the session.");
    console.log("==================================================\n");
  } catch (err: any) {
    console.error(`❌ Failed to initialize remote thread: ${err.message}`);
    process.exit(1);
  }

  // Every completion lists everything the thread has ever produced, so without
  // this each turn would re-download and rewrite the files earlier turns already
  // delivered. Keyed by content as well as name, so a revised article is
  // recognised as new and written again.
  const delivered = new Set<string>();

  function askQuestion() {
    rl.question("\n👤 You: ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        console.log("\n👋 Exiting CLI. Goodbye!");
        rl.close();
        process.exit(0);
      }

      console.log("\n🤖 Agent executing...\n");

      try {
        const runId = await triggerAWSRun(apiKey, threadId, trimmed);
        const deliveries: Promise<void>[] = [];

        connectAWSStream(
          apiKey,
          threadId,
          runId,
          {
            onProgress: (node, status) => {
              // Log progress to stderr so that stdout is clean if redirected
              process.stderr.write(`🔄 [${node}] ${status}\n`);
            },
            onArtifact: (artifact) => {
              const seen = `${artifact.name}@${artifact.sha256}`;
              if (delivered.has(seen)) return;
              delivered.add(seen);

              deliveries.push(
                deliverArtifact(apiKey, threadId, artifact, { outDir, allowAnyPath }, {
                  onSaved: (target) => process.stderr.write(`💾 Saved to ${target}\n`),
                  onFailed: (message) => {
                    // The agent believes this file was delivered. If it was
                    // not, say so here — that gap is the entire bug this
                    // mechanism exists to close.
                    delivered.delete(seen);
                    process.stderr.write(`⚠️  ${message}\n`);
                  },
                }),
              );
            },
            onComplete: async (responseText) => {
              // Settle the downloads before the reply, so the paths are on
              // screen above the message that talks about them.
              await Promise.all(deliveries);
              console.log("\n--------------------------------------------------");
              console.log("🤖 Response:");
              console.log(responseText);
              console.log("--------------------------------------------------");
              askQuestion();
            },
            onError: (err) => {
              console.error(`\n❌ Stream error: ${err.message}`);
              askQuestion();
            }
          }
        );
      } catch (err: any) {
        console.error(`\n❌ Error triggering run: ${err.message}`);
        askQuestion();
      }
    });
  }

  askQuestion();
}
