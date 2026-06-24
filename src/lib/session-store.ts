import crypto from 'crypto';

export interface OrgSession {
    accessToken: string;
    instanceUrl: string;
    orgName?: string;
    username?: string;
}

const ALGORITHM = 'aes-256-gcm';

// Derive key once at module load — scryptSync is intentionally slow, so cache it
const key = crypto.scryptSync(
    process.env.SESSION_SECRET || 'dev-secret-change-in-production-min32ch',
    'sf-migration-salt',
    32
);

export function saveSession(data: OrgSession): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

export function getSession(token: string): OrgSession | undefined {
    try {
        const buf = Buffer.from(token, 'base64url');
        const iv = buf.subarray(0, 12);
        const authTag = buf.subarray(12, 28);
        const encrypted = buf.subarray(28);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    } catch {
        return undefined;
    }
}

export function deleteSession(_id: string): void {
    // Sessions live in cookies — clear the cookie on the response to delete
}
