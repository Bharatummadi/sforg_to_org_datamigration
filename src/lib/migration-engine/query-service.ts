import { Connection } from 'jsforce';

export interface QueryOptions {
    objectName: string;
    fields: string[];
    whereClause?: string;
    limit?: number;
}

/**
 * Generates a SOQL query string.
 */
export function buildQuery({ objectName, fields, whereClause, limit }: QueryOptions): string {
    const fieldList = fields.length > 0 ? fields.join(', ') : 'Id';
    let query = `SELECT ${fieldList} FROM ${objectName}`;

    if (whereClause) {
        query += ` WHERE ${whereClause}`;
    }

    if (limit) {
        query += ` LIMIT ${limit}`;
    }

    return query;
}

/**
 * Executes a query and returns the records.
 * Handles extensive data sets could require QueryMore, but for MVP we might fetch in batches.
 */
export async function executeQuery(conn: Connection, query: string) {
    try {
        const result = await conn.query(query);
        return result.records;
    } catch (error) {
        console.error(`Query failed: ${query}`, error);
        throw error;
    }
}

/**
 * Helper to build an IN clause safely.
 */
export function buildIdsWhereClause(field: string, ids: string[]): string {
    if (ids.length === 0) return 'Id = null'; // Return empty set if no IDs
    const quotedIds = ids.map(id => `'${id}'`).join(', ');
    return `${field} IN (${quotedIds})`;
}
