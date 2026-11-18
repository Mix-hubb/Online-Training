// Active FileStorage: Bunny Storage when configured, otherwise local disk (dev/test).
import type { FileStorage } from './FileStorage.js';
import { BunnyStorage } from './BunnyStorage.js';
import { LocalStorage } from './LocalStorage.js';
import { config } from '../../config.js';

export const storage: FileStorage = config.bunnyStorageEnabled ? new BunnyStorage() : new LocalStorage();
export type { FileStorage };
