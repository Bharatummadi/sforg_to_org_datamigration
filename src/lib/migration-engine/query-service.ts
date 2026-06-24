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
 * Executes a query and fetches ALL records by following Salesforce's queryMore pagination.
 * This handles datasets larger than the default 2,000-record page size.
 */
export async function executeQuery(conn: Connection, query: string): Promise<any[]> {
    try {
        let result = await conn.query(query);
        const records: any[] = [...result.records];

        while (!result.done && result.nextRecordsUrl) {
            result = await conn.queryMore(result.nextRecordsUrl);
            records.push(...result.records);
        }

        return records;
    } catch (error) {
        console.error(`Query failed: ${query}`, error);
        throw error;
    }
}

/**
 * Splits IDs into chunks of 100 and builds a safe IN clause using OR to avoid
 * Salesforce's ~4,000 character expression limit.
 */
export function buildIdsWhereClause(field: string, ids: string[]): string {
    if (ids.length === 0) return 'Id = null';

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
        chunks.push(ids.slice(i, i + 100));
    }

    const clauses = chunks.map(
        chunk => `${field} IN (${chunk.map(id => `'${id}'`).join(', ')})`
    );

    return clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`;
}
