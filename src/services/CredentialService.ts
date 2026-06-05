/**
 * CredentialService — Secure credential storage via Dexie.js (Spec §10.1, §10.8)
 *
 * Stores the GitHub PAT and RemoteConfig in IndexedDB.
 * These values are NEVER written to lightning-fs, .typegraph.yaml, or any Git commit.
 */
import Dexie, { type Table } from 'dexie';

// ============================================================
// Data Shapes
// ============================================================

export interface RemoteConfig {
  url: string;       // "https://github.com/user/repo.git"
  corsProxy: string; // "https://cors.isomorphic-git.org"
  branch: 'main';
  label: 'origin';
  authorName?: string;
  authorEmail?: string;
}

export interface AIConfig {
  provider?: 'local_browser' | 'api';
  baseUrl: string;
  model: string;
  apiKey?: string;
}

interface CredentialRow {
  key: string;
  value: string;
}

// ============================================================
// Dexie Database
// ============================================================

class CredentialDatabase extends Dexie {
  credentials!: Table<CredentialRow, string>;

  constructor() {
    super('typegraph_credentials');
    this.version(1).stores({
      credentials: 'key',
    });
  }
}

const db = new CredentialDatabase();

// ============================================================
// Keys
// ============================================================

const KEY_PAT = 'github_pat';
const KEY_REMOTE = 'remote_config';
const KEY_AI_CONFIG = 'ai_config';
const DEFAULT_CORS_PROXY = 'https://cors.isomorphic-git.org';

// ============================================================
// CredentialService
// ============================================================

export class CredentialService {
  /**
   * Save the AIConfig (baseUrl + model + apiKey) to IndexedDB.
   */
  static async saveAIConfig(config: AIConfig): Promise<void> {
    await db.credentials.put({
      key: KEY_AI_CONFIG,
      value: JSON.stringify(config),
    });
  }

  /**
   * Load AIConfig from IndexedDB. Returns default config if not configured.
   */
  static async loadAIConfig(): Promise<AIConfig> {
    const row = await db.credentials.get(KEY_AI_CONFIG);
    if (!row) {
      return {
        provider: 'local_browser',
        baseUrl: 'http://localhost:11434/v1',
        model: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
      };
    }
    try {
      const parsed = JSON.parse(row.value) as AIConfig;
      return {
        provider: parsed.provider || 'local_browser',
        baseUrl: parsed.baseUrl || 'http://localhost:11434/v1',
        model: parsed.model || 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
        apiKey: parsed.apiKey,
      };
    } catch {
      return {
        provider: 'local_browser',
        baseUrl: 'http://localhost:11434/v1',
        model: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
      };
    }
  }

  /**
   * Save a GitHub Personal Access Token to IndexedDB.
   * Rejects http:// remote URLs (HTTPS-only rule from §10.8).
   */
  static async savePAT(pat: string): Promise<void> {
    await db.credentials.put({ key: KEY_PAT, value: pat });
  }

  /**
   * Load the GitHub PAT from IndexedDB. Returns null if not set.
   */
  static async loadPAT(): Promise<string | null> {
    const row = await db.credentials.get(KEY_PAT);
    return row?.value ?? null;
  }

  /**
   * Save the RemoteConfig (url + corsProxy) to IndexedDB.
   * Enforces HTTPS-only URL requirement.
   */
  static async saveRemoteConfig(config: RemoteConfig): Promise<void> {
    if (config.url.startsWith('http://')) {
      throw new Error(
        'Kun HTTPS-remotes er tilladt. Brug "https://" i stedet for "http://".',
      );
    }
    await db.credentials.put({
      key: KEY_REMOTE,
      value: JSON.stringify(config),
    });
  }

  /**
   * Load RemoteConfig from IndexedDB. Returns null if not configured.
   */
  static async loadRemoteConfig(): Promise<RemoteConfig | null> {
    const row = await db.credentials.get(KEY_REMOTE);
    if (!row) return null;
    try {
      return JSON.parse(row.value) as RemoteConfig;
    } catch {
      return null;
    }
  }

  /**
   * Build a RemoteConfig from a raw GitHub URL, using sensible defaults.
   */
  static buildConfig(url: string, corsProxy?: string, authorName?: string, authorEmail?: string): RemoteConfig {
    return {
      url,
      corsProxy: corsProxy ?? DEFAULT_CORS_PROXY,
      branch: 'main',
      label: 'origin',
      authorName,
      authorEmail,
    };
  }

  /**
   * Clear all stored credentials (PAT + RemoteConfig + AIConfig).
   * Called when the user explicitly signs out or resets.
   */
  static async clearAll(): Promise<void> {
    await db.credentials.bulkDelete([KEY_PAT, KEY_REMOTE, KEY_AI_CONFIG]);
  }
}
