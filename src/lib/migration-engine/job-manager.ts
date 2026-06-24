import fs from 'fs';
import path from 'path';

interface JobState {
    id: string;
    status: 'pending' | 'scanning' | 'migrating' | 'completed' | 'failed';
    logs: string[];
    startTime: number;
}

const DB_PATH = path.join(process.cwd(), 'migration-jobs.json');

// In-memory store for fast writes during an active migration.
const memoryStore: Record<string, JobState> = {};

// Debounce log writes — at most one disk write per 100ms.
let logWriteTimer: ReturnType<typeof setTimeout> | null = null;

function flushToDisk(): Promise<void> {
    // Cancel any pending debounced write and write immediately.
    if (logWriteTimer) {
        clearTimeout(logWriteTimer);
        logWriteTimer = null;
    }
    return fs.promises
        .writeFile(DB_PATH, JSON.stringify(memoryStore, null, 2))
        .catch(e => console.error('Failed to write jobs DB', e));
}

function scheduleDiskWrite() {
    if (logWriteTimer) return;
    logWriteTimer = setTimeout(() => {
        logWriteTimer = null;
        flushToDisk();
    }, 100);
}

async function readFromDisk(): Promise<Record<string, JobState>> {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = await fs.promises.readFile(DB_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to read jobs DB', e);
    }
    return {};
}

export const JobManager = {
    createJob(id: string) {
        memoryStore[id] = {
            id,
            status: 'pending',
            logs: [],
            startTime: Date.now(),
        };
        // Write immediately so the job exists on disk right away.
        flushToDisk();
    },

    async getJob(id: string): Promise<JobState | undefined> {
        // Always read from disk so the status route gets fresh data even if
        // Next.js loads the module in a separate context from the start route.
        const disk = await readFromDisk();
        // Merge in-memory logs on top of disk state (memory may be ahead).
        if (memoryStore[id] && disk[id]) {
            return memoryStore[id].logs.length >= disk[id].logs.length
                ? memoryStore[id]
                : disk[id];
        }
        return memoryStore[id] ?? disk[id];
    },

    addLog(id: string, message: string) {
        if (!memoryStore[id]) return;
        memoryStore[id].logs.push(`[${new Date().toISOString()}] ${message}`);
        scheduleDiskWrite(); // debounced — at most one write per 100ms
    },

    updateStatus(id: string, status: JobState['status']) {
        if (!memoryStore[id]) return;
        memoryStore[id].status = status;
        // Flush immediately on status changes — the client polls on status,
        // and we want completed/failed to be on disk before the next poll.
        flushToDisk();
    },
};
