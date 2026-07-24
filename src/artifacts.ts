import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";

/**
 * Writing files the remote agent produced onto this machine.
 *
 * The agent runs in a container. Its `save_article` tool writes with `fs`, so
 * before this existed the file landed on the container's own disk — a real
 * path, reported confidently, on a filesystem nobody here can reach. The
 * service now publishes what it wrote as a retrievable artifact; this is the
 * half that turns one into a file the user can actually open.
 */

export interface ArtifactMeta {
  name: string;
  size: number;
  sha256: string;
  createdAt?: string;
  /** Folder the user asked for, as they typed it. Honoured only when allowed. */
  destination?: string;
}

export interface WriteOptions {
  /** Where artifacts go unless a destination is both present and permitted. */
  outDir: string;
  /**
   * Whether a server-supplied destination may send a write outside `outDir`.
   *
   * Off by default. The filename and the folder are both chosen by a language
   * model on the far side of the network, which makes this a remote write
   * primitive; it is opt-in for the same reason `curl | sh` should be.
   */
  allowAnyPath?: boolean;
}

export class ArtifactError extends Error {}

/** Expands a leading `~`, matching what the shell would have done. */
function expandHome(folder: string): string {
  // Callback form: a home directory containing "$" must not be read as a
  // replacement pattern.
  return folder.trim().replace(/^~(?=[\\/]|$)/, () => os.homedir());
}

/**
 * Decides where an artifact is allowed to land.
 *
 * The filename is reduced to a bare basename, so no combination of `..`,
 * absolute paths or separators can climb out of the directory chosen here.
 */
export function resolveArtifactPath(
  artifact: Pick<ArtifactMeta, "name" | "destination">,
  options: WriteOptions,
): string {
  // Trimmed before the check as well as after: `path.basename("   ")` is a
  // three-space filename, which is truthy, is neither "." nor "..", and is not
  // something anyone meant to ask for.
  const filename = path.basename(artifact.name.trim()).trim();
  if (!filename || filename === "." || filename === "..") {
    throw new ArtifactError(`Refusing to write an artifact with the unusable name "${artifact.name}".`);
  }

  const outDir = path.resolve(expandHome(options.outDir));
  if (!artifact.destination) return path.join(outDir, filename);

  const destination = path.resolve(expandHome(artifact.destination));
  if (options.allowAnyPath) return path.join(destination, filename);

  // Inside the sandbox already: honour it without needing the flag, since the
  // flag exists to bound where writes can go, not to forbid subfolders.
  const relative = path.relative(outDir, destination);
  const isInside = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (isInside) return path.join(destination, filename);

  throw new ArtifactError(
    `The agent asked to write "${filename}" to "${artifact.destination}", which is outside ` +
      `${outDir}. Re-run with --allow-any-path to permit that, or use --out-dir to move the ` +
      `directory artifacts are written to.`,
  );
}

/**
 * Writes one artifact to disk and returns where it went.
 *
 * The hash is verified before the write, not after: an article that arrived
 * truncated or altered should never reach the user's disk at all, and a
 * mismatch is worth surfacing rather than silently accepting.
 */
export function writeArtifact(
  artifact: ArtifactMeta,
  content: string,
  options: WriteOptions,
): string {
  const actual = createHash("sha256").update(content, "utf-8").digest("hex");
  if (artifact.sha256 && actual !== artifact.sha256) {
    throw new ArtifactError(
      `"${artifact.name}" did not survive the transfer intact (expected ${artifact.sha256.slice(0, 12)}…, ` +
        `got ${actual.slice(0, 12)}…). Nothing was written.`,
    );
  }

  const target = resolveArtifactPath(artifact, options);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
  return target;
}
