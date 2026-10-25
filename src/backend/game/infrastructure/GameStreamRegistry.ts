import { readGameRevision, readDatabaseVersion } from './GameRevision';
import { StreamRegistry } from './StreamRegistry';
const globalStreams = globalThis as typeof globalThis & { __gameStreams?: StreamRegistry };
const configured = Number(process.env.GAME_STREAM_LIMIT ?? 2000);
export const gameStreams = globalStreams.__gameStreams ??= new StreamRegistry(readGameRevision, Number.isInteger(configured) && configured > 0 ? configured : 2000, readDatabaseVersion);
