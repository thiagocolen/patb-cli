import https from "https";
import http from "http";
import type { ArtifactMeta } from "./artifacts.js";

/** The deployed service. Every request goes here unless told otherwise. */
export const DEFAULT_HOST = "https://d33ib4uu7f4xpi.cloudfront.net";

let baseUrl = new URL(DEFAULT_HOST);

/**
 * Points the client at a different service.
 *
 * The deployed host is the default and the normal case. An override exists so
 * a locally running server can be driven by the real client — which is the only
 * way to exercise the whole path, artifact delivery included, without first
 * deploying to production.
 */
export function setRemoteHost(host: string): void {
  baseUrl = new URL(/^https?:\/\//.test(host) ? host : `https://${host}`);
}

export function remoteHostLabel(): string {
  return baseUrl.origin;
}

/** Request options and the matching module, so plain http works for localhost. */
function requestTo(path: string, method: string, headers: Record<string, string>) {
  const isSecure = baseUrl.protocol === "https:";
  return {
    transport: isSecure ? https : http,
    options: {
      hostname: baseUrl.hostname,
      port: baseUrl.port || (isSecure ? 443 : 80),
      path,
      method,
      headers,
    },
  };
}

/**
 * Downloads the bytes of one artifact the agent produced.
 *
 * Separate from the event stream on purpose: the announcement carries only a
 * name and a hash, so a large article never has to survive an SSE frame, and a
 * failed download can be retried without disturbing a run in progress.
 */
export function fetchArtifact(apiKey: string, threadId: string, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { transport, options } = requestTo(
      `/threads/${threadId}/artifacts/${encodeURIComponent(name)}`,
      "GET",
      { "X-API-Key": apiKey },
    );

    const req = transport.request(options, (res) => {
      let body = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`the service returned ${res.statusCode} for "${name}": ${body}`));
          return;
        }
        resolve(body);
      });
    });

    req.on("error", reject);
    req.end();
  });
}

export function createAWSThread(apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { transport, options } = requestTo("/threads", "POST", {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    });

    const req = transport.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.thread_id) {
            resolve(parsed.thread_id);
          } else {
            reject(new Error(body || "No thread ID returned"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

export function triggerAWSRun(apiKey: string, threadId: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { transport, options } = requestTo(`/threads/${threadId}/runs`, "POST", {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    });

    const req = transport.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.run_id) {
            resolve(parsed.run_id);
          } else {
            reject(new Error(body || "No run ID returned"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(JSON.stringify({ agentName: "the-brain", prompt, wait: false }));
    req.end();
  });
}

export function connectAWSStream(
  apiKey: string,
  threadId: string,
  runId: string,
  callbacks: {
    onProgress: (node: string, status: string) => void;
    onArtifact?: (artifact: ArtifactMeta) => void;
    onComplete: (content: string) => void;
    onError: (err: any) => void;
  }
) {
  // Announced artifacts, so the reconciliation on `complete` does not offer the
  // same file twice.
  const announced = new Set<string>();

  const announce = (artifact: ArtifactMeta | undefined) => {
    if (!artifact?.name || announced.has(artifact.name)) return;
    announced.add(artifact.name);
    callbacks.onArtifact?.(artifact);
  };
  const { transport, options } = requestTo(
    `/threads/${threadId}/runs/${runId}/stream`,
    "GET",
    { "X-API-Key": apiKey, Accept: "text/event-stream" },
  );

  const req = transport.request(options, (res) => {
    let buffer = "";

    res.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep last incomplete line

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const data = line.substring(5).trim();
          try {
            const parsed = JSON.parse(data);
            if (parsed.event === "progress") {
              callbacks.onProgress(parsed.progress.node, parsed.progress.status);
            } else if (parsed.event === "artifact") {
              // The agent wrote a file. Offered as soon as it exists, rather
              // than at the end, so a long run delivers as it goes.
              announce(parsed.artifact);
            } else if (parsed.event === "complete") {
              // The service used to route a supervisor to several specialist
              // nodes, each returning its own slice of state, and this branch
              // once picked between writerState.draftArticle,
              // instructorState.explanation and developerState.testResults.
              // That architecture is gone: there is one agent now, and every
              // reply — a lesson, an article, a publish report — arrives in
              // `instructorState.explanation`, which the service keeps for
              // exactly this reason. The other two shapes can no longer be
              // sent, so testing for them only obscured what actually happens.
              //
              // Everything the thread produced, including anything whose live
              // announcement was missed — a stream attached late, or a frame
              // lost. `announce` de-duplicates, so this is a safety net, not a
              // second delivery.
              for (const artifact of parsed.data?.artifacts ?? []) announce(artifact);

              let responseText = "";
              if (parsed.data?.error) {
                responseText = `Error: ${parsed.data.error}`;
              } else if (parsed.data?.result?.instructorState?.explanation) {
                responseText = parsed.data.result.instructorState.explanation;
              } else if (parsed.data?.result?.messages) {
                // Fallback for a run that produced messages but no explanation.
                const aiMsgs = (parsed.data.result.messages || [])
                  .filter(
                    (m: any) => m.type === "ai" || m.lc === 1 || m.kwargs?.content,
                  )
                  .map((m: any) => m.kwargs?.content || "");
                responseText =
                  aiMsgs.length > 0
                    ? aiMsgs.join("\n\n")
                    : "Workflow completed.";
              } else {
                responseText = "Workflow completed successfully.";
              }
              callbacks.onComplete(responseText);
            }
          } catch (e) {
            // ignore non-JSON stream parts
          }
        }
      }
    });
  });

  req.on("error", (e) => {
    callbacks.onError(e);
  });

  req.end();
}
