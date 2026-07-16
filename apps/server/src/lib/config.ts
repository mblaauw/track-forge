import { loadConfig } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";

let _config: Config | null = null;

export function initConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
