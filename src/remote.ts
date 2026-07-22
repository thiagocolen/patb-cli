import https from "https";

const remoteHost = "d33ib4uu7f4xpi.cloudfront.net";

export function createAWSThread(apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: remoteHost,
      path: "/threads",
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
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
    const options = {
      hostname: remoteHost,
      path: `/threads/${threadId}/runs`,
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
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
    onComplete: (content: string) => void;
    onError: (err: any) => void;
  }
) {
  const options = {
    hostname: remoteHost,
    path: `/threads/${threadId}/runs/${runId}/stream`,
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
      Accept: "text/event-stream",
    },
  };

  const req = https.request(options, (res) => {
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
