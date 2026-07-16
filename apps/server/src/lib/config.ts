import { loadConfig } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";

let _config: Config | null = null;

export function initConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/** @internal */
function getConfig(): Config {
  if (!_config)
    throw new Error("Config not initialized. Call initConfig() first.");
  return _config;
}
