import { fetchArtifact } from "./remote.js";
import { writeArtifact, ArtifactError, type ArtifactMeta, type WriteOptions } from "./artifacts.js";

/**
 * Turns an artifact announcement into a file on this machine.
 *
 * Delivery failure is reported, never silent and never fatal: the article still
 * exists on the service and can be fetched again, and losing a download must
 * not take down the conversation that produced it. Silence is the specific
 * failure this whole mechanism exists to end — a file reported saved that was
 * never anywhere the user could reach.
 */
export async function deliverArtifact(
  apiKey: string,
  threadId: string,
  artifact: ArtifactMeta,
  options: WriteOptions,
  report: { onSaved: (path: string) => void; onFailed: (message: string) => void },
): Promise<void> {
  try {
    const content = await fetchArtifact(apiKey, threadId, artifact.name);
    report.onSaved(writeArtifact(artifact, content, options));
  } catch (err: any) {
    const reason = err instanceof ArtifactError ? err.message : `could not fetch it — ${err.message}`;
    report.onFailed(`Could not save "${artifact.name}": ${reason}`);
  }
}
