
interface JobState {
    id: string;
    status: 'pending' | 'scanning' | 'migrating' | 'completed' | 'failed';
    logs: string[];
    startTime: number;
}

import fs from 'fs';
import path from 'path';

interface JobState {
    id: string;
    status: 'pending' | 'scanning' | 'migrating' | 'completed' | 'failed';
    logs: string[];
    startTime: number;
}

const DB_PATH = path.join(process.cwd(), 'migration-jobs.json');

// Helper to read DB
function readDb(): Record<string, JobState> {
    try {
        if (!fs.existsSync(DB_PATH)) {
            return {};
        }
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Failed to read jobs DB', e);
        return {};
    }
}

// Helper to write DB
function writeDb(data: Record<string, JobState>) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to write jobs DB', e);
    }
}

export const JobManager = {
    createJob(id: string) {
        const db = readDb();
        db[id] = {
            id,
            status: 'pending',
            logs: [],
            startTime: Date.now(),
        };
        writeDb(db);
    },

    getJob(id: string) {
        const db = readDb();
        return db[id];
    },

    addLog(id: string, message: string) {
        const db = readDb();
        if (db[id]) {
            db[id].logs.push(`[${new Date().toISOString()}] ${message}`);
            writeDb(db);
        }
    },

    updateStatus(id: string, status: JobState['status']) {
        const db = readDb();
        if (db[id]) {
            db[id].status = status;
            writeDb(db);
        }
    }
};
