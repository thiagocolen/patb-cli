#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { runInteractiveCLI } from "./cli.js";
import { runBridgeMode } from "./bridge.js";
import { setRemoteHost } from "./remote.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("Pinky and the Brain CLI (patb-cli)");
  console.log("\nUsage:");
  console.log("  patb-cli                 Start the interactive agent REPL");
  console.log("  patb-cli --bridge, -b    Start Zed ACP bridge server (JSON-RPC 2.0)");
  console.log("  patb-cli --help, -h      Show this help message");
  console.log("\nOptions:");
  console.log("  --out-dir <path>         Where files the agent writes are saved");
  console.log("                           (default: ./articles, env: PATBA_OUT_DIR)");
  console.log("  --allow-any-path         Let the agent direct a write outside --out-dir.");
  console.log("                           Off by default: the agent runs remotely, so both");
  console.log("                           the folder and the filename come from the network.");
  console.log("  --host <url>             Service to talk to (default: the deployed one,");
  console.log("                           env: PATBA_HOST)");
  process.exit(0);
}

const options = loadConfig(args);
if (options.host) setRemoteHost(options.host);

if (args.includes("--bridge") || args.includes("-b")) {
  runBridgeMode(options);
} else {
  runInteractiveCLI(options);
}
