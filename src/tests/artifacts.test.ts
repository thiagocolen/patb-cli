import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";

import { resolveArtifactPath, writeArtifact, ArtifactError } from "../artifacts.js";

/**
 * These tests guard a remote write primitive.
 *
 * Both the filename and the destination folder of an artifact are chosen on the
 * far side of the network, by a language model. Everything here is about what
 * happens when those values are not what a well-behaved agent would send.
 */

const sha = (content: string) => createHash("sha256").update(content, "utf-8").digest("hex");

let outDir: string;

beforeEach(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "patb-artifacts-"));
});

afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true });
});

describe("resolveArtifactPath", () => {
  it("puts a plain artifact in the output directory", () => {
    const resolved = resolveArtifactPath({ name: "article.md" }, { outDir });
    expect(resolved).toBe(path.join(outDir, "article.md"));
  });

  it("strips any directory the name tries to carry", () => {
    for (const name of ["../../escape.md", "/etc/passwd", "..\\..\\escape.md", "sub/dir/a.md"]) {
      const resolved = resolveArtifactPath({ name }, { outDir });
      expect(path.dirname(resolved)).toBe(outDir);
    }
  });

  it("rejects a name that reduces to nothing usable", () => {
    expect(() => resolveArtifactPath({ name: ".." }, { outDir })).toThrow(ArtifactError);
    expect(() => resolveArtifactPath({ name: "   " }, { outDir })).toThrow(ArtifactError);
  });

  it("refuses a destination outside the output directory", () => {
    const outside = path.join(os.tmpdir(), "somewhere-else");
    expect(() =>
      resolveArtifactPath({ name: "a.md", destination: outside }, { outDir }),
    ).toThrow(ArtifactError);
  });

  it("explains how to permit a refused destination", () => {
    // A refusal the user cannot act on is just a broken feature.
    try {
      resolveArtifactPath({ name: "a.md", destination: "C:/Windows" }, { outDir });
      expect.unreachable("should have refused");
    } catch (err: any) {
      expect(err.message).toContain("--allow-any-path");
      expect(err.message).toContain("--out-dir");
    }
  });

  it("honours a destination outside the sandbox once explicitly allowed", () => {
    const outside = path.join(os.tmpdir(), "explicitly-allowed");
    const resolved = resolveArtifactPath(
      { name: "a.md", destination: outside },
      { outDir, allowAnyPath: true },
    );
    expect(resolved).toBe(path.join(outside, "a.md"));
  });

  it("allows a subfolder of the output directory without the flag", () => {
    // The flag bounds where writes may go; it is not meant to forbid the agent
    // from organising files inside the directory it was already given.
    const nested = path.join(outDir, "cellular-automata");
    const resolved = resolveArtifactPath({ name: "a.md", destination: nested }, { outDir });
    expect(resolved).toBe(path.join(nested, "a.md"));
  });

  it("does not let a destination climb out via ..", () => {
    const climbing = path.join(outDir, "..", "..", "elsewhere");
    expect(() =>
      resolveArtifactPath({ name: "a.md", destination: climbing }, { outDir }),
    ).toThrow(ArtifactError);
  });

  it("expands a leading ~ the way the shell would", () => {
    const resolved = resolveArtifactPath(
      { name: "a.md", destination: "~/patb-docs" },
      { outDir, allowAnyPath: true },
    );
    expect(resolved).toBe(path.join(os.homedir(), "patb-docs", "a.md"));
  });
});

describe("writeArtifact", () => {
  it("writes the file and reports where it went", () => {
    const content = "# Automata\n\nA grid and a rule.\n";
    const target = writeArtifact(
      { name: "automata.md", size: content.length, sha256: sha(content) },
      content,
      { outDir },
    );

    expect(target).toBe(path.join(outDir, "automata.md"));
    expect(fs.readFileSync(target, "utf-8")).toBe(content);
  });

  it("creates the directory when it does not exist yet", () => {
    const fresh = path.join(outDir, "new", "nested");
    const target = writeArtifact(
      { name: "a.md", size: 1, sha256: sha("x"), destination: fresh },
      "x",
      { outDir },
    );
    expect(fs.existsSync(target)).toBe(true);
  });

  it("writes nothing when the content does not match its hash", () => {
    // A truncated or altered article must not reach the user's disk at all —
    // silently accepting one is how a corrupted file passes for a good one.
    expect(() =>
      writeArtifact({ name: "a.md", size: 5, sha256: sha("original") }, "tampered", { outDir }),
    ).toThrow(ArtifactError);

    expect(fs.existsSync(path.join(outDir, "a.md"))).toBe(false);
  });

  it("names both hashes so a mismatch can be investigated", () => {
    try {
      writeArtifact({ name: "a.md", size: 5, sha256: sha("original") }, "tampered", { outDir });
      expect.unreachable("should have refused");
    } catch (err: any) {
      expect(err.message).toContain(sha("original").slice(0, 12));
      expect(err.message).toContain(sha("tampered").slice(0, 12));
    }
  });

  it("overwrites a revised article in place", () => {
    const first = "# First\n";
    const second = "# Second\n";
    writeArtifact({ name: "a.md", size: 1, sha256: sha(first) }, first, { outDir });
    const target = writeArtifact({ name: "a.md", size: 1, sha256: sha(second) }, second, { outDir });

    expect(fs.readFileSync(target, "utf-8")).toBe(second);
  });

  it("writes a file whose hash the service did not supply", () => {
    // Forward compatibility: an older service that announces no hash should
    // still deliver, rather than having every download refused.
    const target = writeArtifact({ name: "a.md", size: 1, sha256: "" }, "x", { outDir });
    expect(fs.readFileSync(target, "utf-8")).toBe("x");
  });
});
