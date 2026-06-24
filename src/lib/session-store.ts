import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface OrgSession {
    accessToken: string;
    instanceUrl: string;
    orgName?: string;
    username?: string;
}

const DB_PATH = path.join(process.cwd(), 'session-store.json');

function readStore(): Record<string, OrgSession> {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to read session store', e);
    }
    return {};
}

function writeStore(store: Record<string, OrgSession>): void {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
    } catch (e) {
        console.error('Failed to write session store', e);
    }
}

export function saveSession(data: OrgSession): string {
    const id = crypto.randomUUID();
    const store = readStore();
    store[id] = data;
    writeStore(store);
    return id;
}

export function getSession(id: string): OrgSession | undefined {
    const store = readStore();
    return store[id];
}

export function deleteSession(id: string): void {
    const store = readStore();
    delete store[id];
    writeStore(store);
}
