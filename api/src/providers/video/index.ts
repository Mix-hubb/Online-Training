// Active VideoProvider: Bunny Stream when configured, otherwise the dev provider.
import type { VideoProvider } from './VideoProvider.js';
import { BunnyStreamProvider } from './BunnyStreamProvider.js';
import { DevVideoProvider } from './DevVideoProvider.js';
import { config } from '../../config.js';

export const video: VideoProvider = config.bunnyStreamEnabled ? new BunnyStreamProvider() : new DevVideoProvider();
export { allowedRenditions, RENDITION_HEIGHTS } from './VideoProvider.js';
