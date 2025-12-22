'use server';

import { cookies } from 'next/headers';
import { createConnection } from '@/lib/salesforce/client';
import { listAllObjects, describeObject } from '@/lib/migration-engine/metadata-service';
import { buildQuery } from '@/lib/migration-engine/query-service';

// Helper to get Source Connection from cookies
async function getSourceConnection() {
    const cookieStore = await cookies();
    const token = cookieStore.get('sf_source_access_token')?.value;
    const instanceUrl = cookieStore.get('sf_source_instance_url')?.value;

    if (!token || !instanceUrl) {
        throw new Error('Not connected to Source Org');
    }
    return createConnection({ accessToken: token, instanceUrl });
}

export async function getSourceObjects() {
    const conn = await getSourceConnection();
    const objects = await listAllObjects(conn);
    return objects.filter(obj => !obj.name.endsWith('__Share') && !obj.name.endsWith('__Feed'));
}

export async function getObjectDetails(objectName: string) {
    const conn = await getSourceConnection();
    return await describeObject(conn, objectName);
}

export async function getRecords(objectName: string, search: string = '', limit: number = 20) {
    const conn = await getSourceConnection();

    // We try to fetch Name, but some objects don't have Name.
    // Ideally we should describe first, but for MVP let's assume Name or fallback to Id.

    const fields = ['Id', 'Name', 'CreatedDate']; // Standard fields

    let whereClause = '';
    if (search) {
        // Sanitize search to prevent injection if not handled by jsforce
        const sanitized = search.replace(/'/g, "\\'");
        whereClause = `Name LIKE '%${sanitized}%'`;
    }

    const query = buildQuery({
        objectName,
        fields,
        whereClause,
        limit
    });

    try {
        const result = await conn.query(query);
        return result.records.map((r: any) => ({
            Id: r.Id,
            Name: r.Name,
            CreatedDate: r.CreatedDate
        }));
    } catch (error) {
        // Fallback: If Name doesn't exist, try just Id and CreatedDate 
        console.warn(`Query with Name failed for ${objectName}, retrying without Name.`, error);
        try {
            // Fallback query (no Name)
            const fallbackQuery = buildQuery({
                objectName,
                fields: ['Id', 'CreatedDate'],
                whereClause: '', // Search typically relies on Name, so disable search in fallback for now
                limit
            });
            const result = await conn.query(fallbackQuery);
            return result.records.map((r: any) => ({
                Id: r.Id,
                Name: r.Id, // Use Id as Name
                CreatedDate: r.CreatedDate
            }));
        } catch (e2) {
            console.error('Fallback query failed', e2);
            throw e2;
        }
    }
}
