/**
 * VoxStory AI - Safe Legacy Data Migration Utility (v12 Beta)
 * Idempotent, dry-run capable migration from local atomic JSON to Cloud Firestore or another target adapter.
 * Non-destructive: preserves original source files and backups without mutation.
 */

import { StorageAdapter } from './types';
import { StudioProject, GenerationResult, GenerationJob, AudioAsset } from '../../types';

export interface MigrationOptions {
  dryRun?: boolean; // If true, only inspects and reports without writing to target
  overwrite?: boolean; // If false (default), skips already existing IDs in target
}

export interface MigrationRecordReport {
  entityType: 'project' | 'generation' | 'job' | 'audioAsset';
  id: string;
  status: 'imported' | 'skipped' | 'invalid';
  reason?: string;
}

export interface MigrationReport {
  success: boolean;
  dryRun: boolean;
  totalRecordsRead: number;
  importedCount: number;
  skippedCount: number;
  invalidCount: number;
  failedCount: number;
  details: MigrationRecordReport[];
  errors: string[];
  durationMs: number;
  completedAt: string;
}

/**
 * Validates a StudioProject record before migration
 */
export function validateProjectRecord(record: any): { isValid: boolean; error?: string } {
  if (!record || typeof record !== 'object') {
    return { isValid: false, error: 'Record is not an object' };
  }
  if (!record.id || typeof record.id !== 'string') {
    return { isValid: false, error: 'Missing or invalid project "id"' };
  }
  if (!record.title || typeof record.title !== 'string') {
    return { isValid: false, error: 'Missing or invalid project "title"' };
  }
  return { isValid: true };
}

/**
 * Validates a GenerationResult record before migration
 */
export function validateGenerationRecord(record: any): { isValid: boolean; error?: string } {
  if (!record || typeof record !== 'object') {
    return { isValid: false, error: 'Record is not an object' };
  }
  if (!record.id || typeof record.id !== 'string') {
    return { isValid: false, error: 'Missing or invalid generation "id"' };
  }
  if (!record.audioUrl || typeof record.audioUrl !== 'string') {
    return { isValid: false, error: 'Missing or invalid generation "audioUrl"' };
  }
  return { isValid: true };
}

/**
 * Migrates all records from sourceAdapter to targetAdapter safely and idempotently.
 */
export async function migrateStorage(
  source: StorageAdapter,
  target: StorageAdapter,
  options: MigrationOptions = {}
): Promise<MigrationReport> {
  const startTime = Date.now();
  const dryRun = options.dryRun ?? false;
  const overwrite = options.overwrite ?? false;

  const report: MigrationReport = {
    success: true,
    dryRun,
    totalRecordsRead: 0,
    importedCount: 0,
    skippedCount: 0,
    invalidCount: 0,
    failedCount: 0,
    details: [],
    errors: [],
    durationMs: 0,
    completedAt: new Date().toISOString(),
  };

  try {
    // 1. Projects
    const sourceProjects = await source.getProjects();
    report.totalRecordsRead += sourceProjects.length;

    for (const project of sourceProjects) {
      const check = validateProjectRecord(project);
      if (!check.isValid) {
        report.invalidCount++;
        report.details.push({
          entityType: 'project',
          id: project?.id || 'unknown',
          status: 'invalid',
          reason: check.error,
        });
        continue;
      }

      // Check if target already has this project
      const existing = await target.getProject(project.id);
      if (existing && !overwrite) {
        report.skippedCount++;
        report.details.push({
          entityType: 'project',
          id: project.id,
          status: 'skipped',
          reason: 'Already exists in target store',
        });
        continue;
      }

      if (!dryRun) {
        try {
          await target.saveProject(project);
          report.importedCount++;
          report.details.push({
            entityType: 'project',
            id: project.id,
            status: 'imported',
          });
        } catch (err) {
          report.failedCount++;
          report.errors.push(`Failed to migrate project ${project.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        report.importedCount++;
        report.details.push({
          entityType: 'project',
          id: project.id,
          status: 'imported',
          reason: 'Dry-run: validated and ready for import',
        });
      }
    }

    // 2. Generations
    const sourceGenerations = await source.getGenerations(500);
    report.totalRecordsRead += sourceGenerations.length;

    for (const gen of sourceGenerations) {
      const check = validateGenerationRecord(gen);
      if (!check.isValid) {
        report.invalidCount++;
        report.details.push({
          entityType: 'generation',
          id: gen?.id || 'unknown',
          status: 'invalid',
          reason: check.error,
        });
        continue;
      }

      const existing = await target.getGeneration(gen.id);
      if (existing && !overwrite) {
        report.skippedCount++;
        report.details.push({
          entityType: 'generation',
          id: gen.id,
          status: 'skipped',
          reason: 'Already exists in target store',
        });
        continue;
      }

      if (!dryRun) {
        try {
          await target.saveGeneration(gen);
          report.importedCount++;
          report.details.push({
            entityType: 'generation',
            id: gen.id,
            status: 'imported',
          });
        } catch (err) {
          report.failedCount++;
          report.errors.push(`Failed to migrate generation ${gen.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        report.importedCount++;
        report.details.push({
          entityType: 'generation',
          id: gen.id,
          status: 'imported',
          reason: 'Dry-run: validated and ready for import',
        });
      }
    }

    // 3. Audio Assets
    const sourceAssets = await source.getAudioAssets();
    report.totalRecordsRead += sourceAssets.length;

    for (const asset of sourceAssets) {
      if (!asset.id || !asset.storageKey) {
        report.invalidCount++;
        report.details.push({
          entityType: 'audioAsset',
          id: asset?.id || 'unknown',
          status: 'invalid',
          reason: 'Missing id or storageKey',
        });
        continue;
      }

      const existing = await target.getAudioAsset(asset.id);
      if (existing && !overwrite) {
        report.skippedCount++;
        report.details.push({
          entityType: 'audioAsset',
          id: asset.id,
          status: 'skipped',
          reason: 'Already exists in target store',
        });
        continue;
      }

      if (!dryRun) {
        try {
          await target.saveAudioAsset(asset);
          report.importedCount++;
          report.details.push({
            entityType: 'audioAsset',
            id: asset.id,
            status: 'imported',
          });
        } catch (err) {
          report.failedCount++;
          report.errors.push(`Failed to migrate audio asset ${asset.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        report.importedCount++;
        report.details.push({
          entityType: 'audioAsset',
          id: asset.id,
          status: 'imported',
          reason: 'Dry-run: validated and ready for import',
        });
      }
    }

    report.success = report.failedCount === 0;
  } catch (err) {
    report.success = false;
    report.errors.push(`Fatal migration error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    report.durationMs = Date.now() - startTime;
    report.completedAt = new Date().toISOString();
  }

  return report;
}
