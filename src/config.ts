import dotenv from "dotenv";
import path from "path";

export function maskKey(key: string): string {
  if (!key) return "undefined";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function loadConfig() {
  // Load from current working directory
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });
  
  const apiKey = process.env.PATBA_API_KEY;
  if (!apiKey) {
    console.error("Error: PATBA_API_KEY environment variable is not set.");
    console.error("Please ensure you have a .env file with PATBA_API_KEY in the current working directory, or set the environment variable.");
    process.exit(1);
  }
  return { apiKey };
}

