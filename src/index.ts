#!/usr/bin/env node

import { loadConfig } from "./config.js";
import { runInteractiveCLI } from "./cli.js";
import { runBridgeMode } from "./bridge.js";

const { apiKey } = loadConfig();

const args = process.argv.slice(2);

if (args.includes("--bridge") || args.includes("-b")) {
  runBridgeMode(apiKey);
} else if (args.includes("--help") || args.includes("-h")) {
  console.log("Pinky and the Brain CLI (patb-cli)");
  console.log("\nUsage:");
  console.log("  patb-cli                 Start the interactive agent REPL");
  console.log("  patb-cli --bridge, -b    Start Zed ACP bridge server (JSON-RPC 2.0)");
  console.log("  patb-cli --help, -h      Show this help message");
} else {
  runInteractiveCLI(apiKey);
}
