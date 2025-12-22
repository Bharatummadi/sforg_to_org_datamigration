import { Connection } from 'jsforce';
import { SalesforceObject, ObjectDescribe } from './types';

/**
 * Fetches all available objects from the Salesforce Org.
 */
export async function listAllObjects(conn: Connection): Promise<SalesforceObject[]> {
    const global = await conn.describeGlobal();
    return global.sobjects.map((sobj) => ({
        name: sobj.name,
        label: sobj.label,
        keyPrefix: sobj.keyPrefix || '',
        custom: sobj.custom,
        createable: sobj.createable,
        updateable: sobj.updateable,
        deletable: sobj.deletable,
    }));
}

/**
 * Describes a specific Salesforce Object (fields, relationships).
 * Caches results in memory could be added here if needed, but for now direct calls.
 */
export async function describeObject(conn: Connection, objectName: string): Promise<ObjectDescribe> {
    const describe = await conn.describe(objectName);

    return {
        name: describe.name,
        fields: describe.fields.map((f) => ({
            name: f.name,
            label: f.label,
            type: f.type,
            nillable: f.nillable,
            updateable: f.updateable,
            createable: f.createable,
            referenceTo: f.referenceTo || undefined,
            relationshipName: f.relationshipName || undefined,
        })),
        childRelationships: describe.childRelationships.map((cr) => ({
            childSObject: cr.childSObject,
            field: cr.field,
            relationshipName: cr.relationshipName || null,
            cascadeDelete: cr.cascadeDelete,
        })),
    };
}
