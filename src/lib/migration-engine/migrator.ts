import { Connection } from 'jsforce';
import { MigrationConfig, MigrationNode } from './types';
import { IdMapper } from './id-mapper';
import { buildQuery, buildIdsWhereClause, executeQuery } from './query-service';
import { createConnection } from '../salesforce/client';

export class Migrator {
    private sourceConn: Connection;
    private targetConn: Connection;
    private config: MigrationConfig;
    private idMapper: IdMapper;

    private onLog: (message: string) => void;

    constructor(config: MigrationConfig, onLog?: (message: string) => void) {
        this.config = config;
        this.sourceConn = createConnection({ accessToken: config.sourceAccessToken, instanceUrl: config.sourceInstanceUrl });
        this.targetConn = createConnection({ accessToken: config.targetAccessToken, instanceUrl: config.targetInstanceUrl });
        this.idMapper = new IdMapper();
        this.onLog = onLog || console.log;
    }

    private log(message: string) {
        this.onLog(message);
    }

    /**
     * Main entry point to run the migration.
     */
    async run() {
        this.log('Starting Migration Job...');

        // 1. Migrate Root Object
        const rootIds = await this.migrateObject(this.config.rootObject, null, this.config.sourceRecordIds || []);

        // 2. Migrate Children recursively
        if (this.config.children && this.config.children.length > 0) {
            for (const childNode of this.config.children) {
                await this.processNode(childNode, this.config.rootObject, rootIds);
            }
        }

        this.log('Migration Job Complete.');
    }

    private async processNode(node: MigrationNode, parentName: string, parentIds: string[]) {
        // Migrate this node (filtered by parent)
        const myIds = await this.migrateChildObject(node.objectName, parentName, parentIds);

        // Recurse for grandchildren
        if (node.children && node.children.length > 0 && myIds && myIds.length > 0) {
            for (const grandChild of node.children) {
                await this.processNode(grandChild, node.objectName, myIds);
            }
        }
    }

    /**
     * Migrates a single object type. 
     * @param objectName The object to migrate
     * @param parentField The field name on this object that points to the parent (if applicable)
     * @param validParentIds The list of parent IDs to filter by (if applicable)
     */
    private async migrateObject(objectName: string, parentField: string | null = null, validParentIds: string[] = []): Promise<string[]> {
        this.log(`Migrating ${objectName}...`);

        // 1. Describe Target to get Schema (Createable & Required Fields)
        const targetDescribe = await this.targetConn.describe(objectName);

        // Set of fields allowed to be created
        const createableFields = new Set(targetDescribe.fields.filter(f => f.createable).map(f => f.name));

        // Identify Required Fields (Createable + Not Nillable + Not Defaulted)
        // Note: We should fetch these from source if possible.
        const requiredFields = targetDescribe.fields
            .filter(f => f.createable && !f.nillable && !f.defaultedOnCreate)
            .map(f => f.name);

        this.log(`Identified ${requiredFields.length} required fields for ${objectName}: ${requiredFields.join(', ')}`);

        // 2. Build Query
        const fields = this.config.selectedFields[objectName] || ['Name']; // Default to Name

        // Ensure standard fields
        if (!fields.includes('Id')) fields.push('Id');
        if (parentField && !fields.includes(parentField)) fields.push(parentField);

        // Merge Required Fields
        requiredFields.forEach(reqField => {
            if (!fields.includes(reqField)) {
                fields.push(reqField);
            }
        });

        let whereClause = '';
        if (validParentIds.length > 0) {
            if (parentField) {
                whereClause = buildIdsWhereClause(parentField, validParentIds);
            } else {
                // Root filtering by ID
                whereClause = buildIdsWhereClause('Id', validParentIds);
            }
        }

        const query = buildQuery({ objectName, fields, whereClause, limit: 100 });

        // 3. Fetch Records
        this.log(`Querying ${objectName} from Source...`);
        const records = await executeQuery(this.sourceConn, query);
        if (records.length === 0) {
            this.log(`No records found for ${objectName}.`);
            return [];
        }

        this.log(`Fetched ${records.length} records for ${objectName}`);

        // 2a. Describe Target to get Createable Fields & Types
        // (Already fetched in Step 1, reusing variables)
        const fieldMap = new Map(targetDescribe.fields.map(f => [f.name, f]));
        // createableFields is already defined in Step 1

        // 3. Transform Records (Remap Ids & Filter Fields)
        const recordsToInsert = records.map((rec: any) => {
            const newRec: any = {};

            // Only include createable fields from source
            Object.keys(rec).forEach(key => {
                // Skip system fields
                if (key === 'Id' || key === 'attributes') return;

                // Check if field is createable in target
                if (!createableFields.has(key)) return;

                // Field Scoping / Safety Checks:

                // 1. Skip OwnerId (default to running user to avoid missing user errors)
                if (key === 'OwnerId') return;

                // 2. Skip RecordTypeId (unless we implement MapRecordTypes later) - Source ID won't match Target ID
                if (key === 'RecordTypeId') return;

                // 3. Handle Lookups
                const fieldDef = fieldMap.get(key);
                if (fieldDef && fieldDef.type === 'reference') {
                    // Only allow this lookup if it's the parent field we are explicitly remapping
                    if (key !== parentField) {
                        // This is an unmapped lookup (e.g. AccountId on a Case when migrating Case as root). 
                        // We must skip it to avoid "Invalid Cross Reference Key" because Source ID != Target ID.
                        // Ideally we'd map this, but we don't have the map for external relations in this scope.
                        return;
                    }
                }

                // If we passed checks, copy value
                newRec[key] = rec[key];
            });

            // Remap Parent Field if it exists
            if (parentField && rec[parentField]) {
                const oldParentId = rec[parentField];
                if (this.idMapper.has(oldParentId)) {
                    newRec[parentField] = this.idMapper.get(oldParentId);
                }
            }
            return newRec;
        });

        // 4. Insert into Target
        this.log(`Inserting ${recordsToInsert.length} records into Target...`);
        const results = await this.targetConn.sobject(objectName).create(recordsToInsert);

        // 5. Update ID Map
        const successfulSourceIds: string[] = [];
        let successCount = 0;
        results.forEach((res, index) => {
            if (res.success) {
                const sourceId = records[index].Id;
                const targetId = res.id;
                if (sourceId && targetId) {
                    this.idMapper.set(sourceId, targetId);
                    successfulSourceIds.push(sourceId);
                    successCount++;
                }
            } else {
                this.log(`Error inserting Record ${index}: ${JSON.stringify(res.errors)}`);
            }
        });

        this.log(`Successfully migrated ${successCount}/${records.length} ${objectName} records.`);

        return successfulSourceIds;
    }

    /**
     * Helper to migrate child object.
     */
    private async migrateChildObject(childObjectName: string, parentObjectName: string, parentIds: string[]): Promise<string[]> {
        // 1. Find relationship field
        const describe = await this.targetConn.describe(childObjectName);
        const relationshipField = describe.fields.find(f => f.referenceTo && f.referenceTo.includes(parentObjectName));

        if (!relationshipField) {
            this.log(`ERROR: No relationship found between ${childObjectName} and ${parentObjectName}`);
            return [];
        }

        this.log(`Found relationship: ${childObjectName}.${relationshipField.name} -> ${parentObjectName}`);

        // 2. Delegate to migrateObject
        return await this.migrateObject(childObjectName, relationshipField.name, parentIds);
    }
}
