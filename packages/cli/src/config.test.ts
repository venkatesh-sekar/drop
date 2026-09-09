import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  configDir,
  deleteCredential,
  getCredential,
  getToken,
  readConfig,
  resolveControlUrl,
  saveCredential,
  writeConfig,
} from "./config.ts";

let home: string;
const savedEnv = { ...process.env };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "drop-cli-test-"));
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.DROP_URL;
  delete process.env.DROP_TOKEN;
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  process.env = { ...savedEnv };
});

describe("control url resolution", () => {
  it("falls back to localhost", () => {
    expect(resolveControlUrl()).toBe("http://localhost:3100");
  });

  it("prefers the flag, then the env, then the config file", () => {
    writeConfig({ url: "https://from-config" });
    expect(resolveControlUrl()).toBe("https://from-config");
    process.env.DROP_URL = "https://from-env";
    expect(resolveControlUrl()).toBe("https://from-env");
    expect(resolveControlUrl("https://from-flag/")).toBe("https://from-flag");
  });

  it("persists a url written by login", () => {
    writeConfig({ url: "https://drop.internal" });
    expect(readConfig().url).toBe("https://drop.internal");
  });
});

describe("credential store", () => {
  const url = "https://drop.internal";

  it("round-trips a credential keyed by control url", () => {
    saveCredential(url, { token: "drop_secret", user: { email: "a@b.c" } });
    expect(getCredential(url)?.token).toBe("drop_secret");
    expect(getCredential(`${url}/`)?.token).toBe("drop_secret");
    expect(getCredential("https://other")).toBeUndefined();
  });

  it("writes the file 0600 and the directory 0700", () => {
    saveCredential(url, { token: "drop_secret" });
    expect(statSync(join(configDir(), "credentials.json")).mode & 0o777).toBe(0o600);
    expect(statSync(configDir()).mode & 0o777).toBe(0o700);
  });

  it("lets DROP_TOKEN win", () => {
    saveCredential(url, { token: "stored" });
    process.env.DROP_TOKEN = "from-ci";
    expect(getToken(url)).toBe("from-ci");
    delete process.env.DROP_TOKEN;
    expect(getToken(url)).toBe("stored");
  });

  it("deletes", () => {
    saveCredential(url, { token: "stored" });
    expect(deleteCredential(url)).toBe(true);
    expect(deleteCredential(url)).toBe(false);
    expect(getCredential(url)).toBeUndefined();
  });
});
