import dotenv from "dotenv";
import path from "path";

export function maskKey(key: string): string {
  if (!key) return "undefined";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export interface CliOptions {
  apiKey: string;
  /** Where files the agent writes are saved on this machine. */
  outDir: string;
  /** Whether the agent may direct a write outside `outDir`. */
  allowAnyPath: boolean;
  /** Service to talk to. Undefined means the deployed one. */
  host?: string;
}

/** Reads `--flag value` or `--flag=value`, returning undefined when absent. */
export function readFlag(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);

  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`Error: --${name} needs a value.`);
    process.exit(1);
  }
  return value;
}

export function loadConfig(args: string[] = process.argv.slice(2)): CliOptions {
  // Load from current working directory
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

  const apiKey = process.env.PATBA_API_KEY;
  if (!apiKey) {
    console.error("Error: PATBA_API_KEY environment variable is not set.");
    console.error("Please ensure you have a .env file with PATBA_API_KEY in the current working directory, or set the environment variable.");
    process.exit(1);
  }

  // Resolved against where the CLI was started: that is the directory the user
  // was looking at when they asked the agent for a file.
  const outDir = path.resolve(
    process.cwd(),
    readFlag(args, "out-dir") ?? process.env.PATBA_OUT_DIR ?? "articles",
  );

  return {
    apiKey,
    outDir,
    allowAnyPath: args.includes("--allow-any-path"),
    host: readFlag(args, "host") ?? process.env.PATBA_HOST,
  };
}

