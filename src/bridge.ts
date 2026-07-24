import readline from "readline";
import { createAWSThread, triggerAWSRun, connectAWSStream } from "./remote.js";
import { deliverArtifact } from "./delivery.js";
import type { CliOptions } from "./config.js";

export function runBridgeMode({ apiKey, outDir, allowAnyPath }: CliOptions) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let isInitialized = false;
  const sessions = new Map<string, string>(); // localSessionId -> AWS threadId

  // Files already written to disk, so a later turn does not rewrite what the
  // completion frame re-lists. Scoped by thread, and by content so that a
  // revised article is delivered again.
  const delivered = new Set<string>();

  rl.on("line", async (line) => {
    if (!line.trim()) return;
    try {
      const request = JSON.parse(line);

      switch (request.method) {
        case "initialize":
          isInitialized = true;
          console.log(
            JSON.stringify({
              jsonrpc: "2.0",
              id: request.id,
              result: {
                protocolVersion: request.params.protocolVersion,
                serverInfo: {
                  name: "patb-cli-bridge",
                  version: "1.0.0",
                },
                capabilities: { agents: true },
              },
            })
          );
          break;

        case "session/new":
          if (!isInitialized) {
            sendError(request.id, -32002, "Server not initialized.");
            break;
          }
          try {
            const threadId = await createAWSThread(apiKey);
            const localSessionId = `session_${Math.random().toString(36).substring(2, 15)}`;
            sessions.set(localSessionId, threadId);
            console.log(
              JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: { sessionId: localSessionId },
              })
            );
          } catch (err: any) {
            sendError(
              request.id,
              -32603,
              `AWS creation failed: ${err.message}`
            );
          }
          break;

        case "session/prompt":
          if (!isInitialized) {
            sendError(request.id, -32002, "Server not initialized.");
            break;
          }
          const session = sessions.get(request.params.sessionId);
          if (!session) {
            sendError(
              request.id,
              -32602,
              `Session not found: ${request.params.sessionId}`
            );
            break;
          }

          let promptText = "";
          if (typeof request.params.prompt === "string") {
            promptText = request.params.prompt;
          } else if (Array.isArray(request.params.prompt)) {
            promptText = request.params.prompt
              .filter(
                (block: any) =>
                  block.type === "text" && typeof block.text === "string"
              )
              .map((block: any) => block.text)
              .join("\n");
          }

          try {
            const runId = await triggerAWSRun(apiKey, session, promptText);
            const deliveries: Promise<void>[] = [];

            /**
             * Says something in the session's transcript.
             *
             * stdout is the JSON-RPC channel here, so a delivery report cannot
             * simply be printed the way the REPL prints it — it has to be a
             * protocol message or it corrupts the stream.
             */
            const say = (id: string, text: string) => {
              console.log(
                JSON.stringify({
                  jsonrpc: "2.0",
                  method: "session/update",
                  params: {
                    sessionId: request.params.sessionId,
                    update: {
                      sessionUpdate: "agent_message_chunk",
                      messageId: id,
                      content: { type: "text", text },
                    },
                  },
                })
              );
            };

            connectAWSStream(
              apiKey,
              session,
              runId,
              {
                onProgress: (node, status) => {
                  say(`progress_${node}_${Date.now()}`, `🔄 [${node}] ${status}\n`);
                },
                onArtifact: (artifact) => {
                  const seen = `${session}:${artifact.name}@${artifact.sha256}`;
                  if (delivered.has(seen)) return;
                  delivered.add(seen);

                  deliveries.push(
                    deliverArtifact(apiKey, session, artifact, { outDir, allowAnyPath }, {
                      onSaved: (target) => say(`artifact_${Date.now()}`, `💾 Saved to ${target}\n`),
                      onFailed: (message) => {
                        delivered.delete(seen);
                        say(`artifact_${Date.now()}`, `⚠️  ${message}\n`);
                      },
                    }),
                  );
                },
                onComplete: async (responseText) => {
                  // Report the files before the reply that refers to them, and
                  // before the turn is declared over.
                  await Promise.all(deliveries);

                  // Send final response text chunk
                  say(`result_${Date.now()}`, responseText);

                  // End turn
                  console.log(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id: request.id,
                      result: { stopReason: "end_turn" },
                    })
                  );
                },
                onError: (err) => {
                  sendError(request.id, -32603, `Stream connection error: ${err.message}`);
                }
              }
            );
          } catch (err: any) {
            sendError(
              request.id,
              -32603,
              `Failed to trigger AWS run: ${err.message}`
            );
          }
          break;

        case "agents/list":
          console.log(
            JSON.stringify({
              jsonrpc: "2.0",
              id: request.id,
              result: {
                agents: [
                  {
                    name: "the-brain",
                    description:
                      "Speaks as The Brain, an instructor on technical domains and world domination.",
                  },
                ],
              },
            })
          );
          break;

        default:
          sendError(request.id, -32601, `Method not found: ${request.method}`);
      }
    } catch (err: any) {
      sendError(null, -32700, `Parse error: ${err.message}`);
    }
  });

  function sendError(id: any, code: number, message: string) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }));
  }
}
