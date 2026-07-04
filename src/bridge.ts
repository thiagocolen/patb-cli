import readline from "readline";
import { createAWSThread, triggerAWSRun, connectAWSStream } from "./remote.js";

export function runBridgeMode(apiKey: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let isInitialized = false;
  const sessions = new Map<string, string>(); // localSessionId -> AWS threadId

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
            
            connectAWSStream(
              apiKey,
              session,
              runId,
              {
                onProgress: (node, status) => {
                  const progressMessage = `🔄 [${node}] ${status}`;
                  console.log(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      method: "session/update",
                      params: {
                        sessionId: request.params.sessionId,
                        update: {
                          sessionUpdate: "agent_message_chunk",
                          messageId: `progress_${node}_${Date.now()}`,
                          content: { type: "text", text: `${progressMessage}\n` },
                        },
                      },
                    })
                  );
                },
                onComplete: (responseText) => {
                  // Send final response text chunk
                  console.log(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      method: "session/update",
                      params: {
                        sessionId: request.params.sessionId,
                        update: {
                          sessionUpdate: "agent_message_chunk",
                          messageId: `result_${Date.now()}`,
                          content: { type: "text", text: responseText },
                        },
                      },
                    })
                  );

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
