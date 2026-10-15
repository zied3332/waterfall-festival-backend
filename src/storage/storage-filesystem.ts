import { lstat, opendir, realpath } from 'node:fs/promises';
import type { Dir, Stats } from 'node:fs';

export const STORAGE_FILESYSTEM = Symbol('STORAGE_FILESYSTEM');

export interface StorageFilesystem {
  lstat(this: void, path: string): Promise<Stats>;
  opendir(this: void, path: string): Promise<Dir>;
  realpath(this: void, path: string): Promise<string>;
}

// Injectable only to make transient filesystem failures testable on every OS.
export const storageFilesystem: StorageFilesystem = {
  lstat: path => lstat(path),
  opendir: path => opendir(path),
  realpath: path => realpath(path),
};
