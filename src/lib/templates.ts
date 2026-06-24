import { MigrationNode } from './migration-engine/types';

export interface MigrationTemplate {
    id: string;
    name: string;
    createdAt: string;
    rootObject: string;
    children: MigrationNode[];
    selectedFields: Record<string, string[]>;
}

const STORAGE_KEY = 'migrationTemplates';

export function getTemplates(): MigrationTemplate[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveTemplate(
    name: string,
    data: Pick<MigrationTemplate, 'rootObject' | 'children' | 'selectedFields'>
): MigrationTemplate {
    const templates = getTemplates();
    const newTemplate: MigrationTemplate = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        createdAt: new Date().toISOString(),
        ...data,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newTemplate, ...templates]));
    return newTemplate;
}

export function deleteTemplate(id: string): void {
    const templates = getTemplates().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
