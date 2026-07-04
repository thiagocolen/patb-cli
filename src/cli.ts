import readline from "readline";
import { createAWSThread, triggerAWSRun, connectAWSStream } from "./remote.js";
import { maskKey } from "./config.js";

export async function runInteractiveCLI(apiKey: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("==================================================");
  console.log("🧠 Pinky and the Brain - Remote Agent CLI REPL");
  console.log(`Initializing remote session (API Key: ${maskKey(apiKey)})...`);
  console.log("==================================================");

  let threadId: string;
  try {
    threadId = await createAWSThread(apiKey);
    console.log(`🧵 Remote Thread ID: ${threadId}`);
    console.log("Type your message to prompt the agent workflow.");
    console.log("Type 'exit' or 'quit' to end the session.");
    console.log("==================================================\n");
  } catch (err: any) {
    console.error(`❌ Failed to initialize remote thread: ${err.message}`);
    process.exit(1);
  }

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
        
        connectAWSStream(
          apiKey,
          threadId,
          runId,
          {
            onProgress: (node, status) => {
              // Log progress to stderr so that stdout is clean if redirected
              process.stderr.write(`🔄 [${node}] ${status}\n`);
            },
            onComplete: (responseText) => {
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
