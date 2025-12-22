export interface SalesforceObject {
    name: string;
    label: string;
    keyPrefix: string;
    custom: boolean;
    createable: boolean;
    updateable: boolean;
    deletable: boolean;
}

export interface SalesforceField {
    name: string;
    label: string;
    type: string;
    nillable: boolean;
    updateable: boolean;
    createable: boolean;
    referenceTo?: string[];
    relationshipName?: string;
}

export interface ObjectDescribe {
    name: string;
    fields: SalesforceField[];
    childRelationships: ChildRelationship[];
}

export interface ChildRelationship {
    childSObject: string;
    field: string;
    relationshipName: string | null;
    cascadeDelete: boolean;
}

export interface MigrationNode {
    objectName: string;
    children?: MigrationNode[];
}

export interface MigrationConfig {
    sourceAccessToken: string;
    sourceInstanceUrl: string;
    targetAccessToken: string;
    targetInstanceUrl: string;
    rootObject: string;
    children: MigrationNode[]; // Recursive list
    selectedFields: Record<string, string[]>; // ObjectName -> FieldName[]
    sourceRecordIds?: string[]; // Optional: Specific IDs to migrate
}
