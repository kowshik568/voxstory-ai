/**
 * VoxStory AI - Storage Subsystem Factory & Fail-Safe Selector (v12 Beta)
 * Explicit storage driver selection with strict production durability enforcement.
 */

import { StorageAdapter, StorageDriverType } from './types';
import { AtomicJsonStorageAdapter } from './storageManager';
import { FirestoreStorageAdapter } from './firestoreAdapter';

export interface StorageConfig {
  driver: StorageDriverType;
  requireDurable: boolean;
  dataPath?: string;
  projectId?: string;
}

export class StorageInitError extends Error {
  public readonly code: string;
  public readonly isDurableFailure: boolean;

  constructor(message: string, code: string, isDurableFailure: boolean = false) {
    super(message);
    this.name = 'StorageInitError';
    this.code = code;
    this.isDurableFailure = isDurableFailure;
  }
}

/**
 * Creates and initializes the active StorageAdapter according to configuration.
 * Strictly prevents silent fallbacks to ephemeral storage when durability is required.
 */
export async function createStorageAdapter(config?: Partial<StorageConfig>): Promise<StorageAdapter> {
  const driver = (config?.driver || process.env.STORAGE_DRIVER || 'local-json-atomic') as StorageDriverType;
  const requireDurable = config?.requireDurable ?? (process.env.STORAGE_REQUIRE_DURABLE === 'true');

  // Enforce production safety: if durability is required, driver must be durable
  if (requireDurable && driver === 'local-json-atomic') {
    throw new StorageInitError(
      'STORAGE_REQUIRE_DURABLE is set to true, but STORAGE_DRIVER is "local-json-atomic". ' +
      'Ephemeral container storage is forbidden when durability is required. ' +
      'Configure STORAGE_DRIVER="firestore-cloud" with valid GCP credentials.',
      'DURABILITY_ENFORCEMENT_VIOLATION',
      true
    );
  }

  let adapter: StorageAdapter;

  switch (driver) {
    case 'firestore-cloud':
      adapter = new FirestoreStorageAdapter({
        projectId: config?.projectId || process.env.GCP_PROJECT_ID,
      });
      break;

    case 'mock-firestore':
      adapter = new FirestoreStorageAdapter({
        projectId: 'mock-voxstory-project',
      });
      break;

    case 'local-json-atomic':
    default:
      adapter = new AtomicJsonStorageAdapter(config?.dataPath);
      break;
  }

  try {
    await adapter.init();
    const health = await adapter.getHealth();
    
    // Check if durable adapter failed initialization
    if (requireDurable && health.status === 'unavailable') {
      throw new StorageInitError(
        `Configured durable storage (${driver}) is unavailable. ` +
        `Failing initialization to protect user data from ephemeral loss.`,
        'DURABLE_STORAGE_UNAVAILABLE',
        true
      );
    }

    return adapter;
  } catch (err: unknown) {
    if (err instanceof StorageInitError) {
      throw err;
    }
    throw new StorageInitError(
      `Failed to initialize storage driver "${driver}": ${err instanceof Error ? err.message : String(err)}`,
      'STORAGE_INIT_FAILED'
    );
  }
}
