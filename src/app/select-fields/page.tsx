'use client';

import { useState, useEffect } from 'react';
import { getObjectDetails } from '@/app/actions/metadata';
import { MigrationConfig, MigrationNode, ObjectDescribe } from '@/lib/migration-engine/types';
import { saveTemplate } from '@/lib/templates';
import { Loader2, ArrowRight, ArrowLeft, ChevronDown, ChevronRight, CheckSquare, Square, BookmarkPlus, XCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SelectFieldsPage() {
    const [config, setConfig] = useState<MigrationConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [objectDescribes, setObjectDescribes] = useState<Record<string, ObjectDescribe>>({});
    const [selectedFields, setSelectedFields] = useState<Record<string, Set<string>>>({});
    const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [savedBanner, setSavedBanner] = useState<string | null>(null);

    // Helper to get all object names from config recursively
    const getAllObjectNames = (node: { rootObject: string, children: MigrationNode[] }) => {
        const names = new Set<string>();
        names.add(node.rootObject);

        const traverse = (nodes: MigrationNode[]) => {
            nodes.forEach(n => {
                names.add(n.objectName);
                if (n.children) traverse(n.children);
            });
        };
        traverse(node.children);
        return Array.from(names);
    };

    useEffect(() => {
        const saved = localStorage.getItem('migrationConfig');
        if (saved) {
            const parsedConfig = JSON.parse(saved);
            setConfig(parsedConfig);

            // Initial fetch of metadata
            const allObjects = getAllObjectNames({
                rootObject: parsedConfig.rootObject,
                children: parsedConfig.children
            });

            async function fetchMetadata() {
                try {
                    const describes: Record<string, ObjectDescribe> = {};
                    // Fetch in parallel
                    await Promise.all(allObjects.map(async (objName) => {
                        try {
                            const desc = await getObjectDetails(objName);
                            describes[objName] = desc;
                        } catch (e) {
                            console.error(`Failed to describe ${objName}`, e);
                        }
                    }));
                    setObjectDescribes(describes);

                    // Initialize selected fields (default to existing config or all createable)
                    const initialSelection: Record<string, Set<string>> = {};
                    allObjects.forEach(objName => {
                        if (parsedConfig.selectedFields && parsedConfig.selectedFields[objName]) {
                            initialSelection[objName] = new Set(parsedConfig.selectedFields[objName]);
                        } else {
                            // Default: Select Name and Id
                            initialSelection[objName] = new Set(['Id', 'Name']);
                        }
                    });
                    setSelectedFields(initialSelection);

                } catch (err) {
                    console.error('Metadata fetch failed', err);
                } finally {
                    setLoading(false);
                }
            }
            fetchMetadata();
            // Auto-expand root
            setExpandedObjects(new Set([parsedConfig.rootObject]));
        } else {
            window.location.href = '/select-objects';
        }
    }, []);

    const toggleField = (objectName: string, fieldName: string) => {
        const currentSet = new Set(selectedFields[objectName] || []);
        if (currentSet.has(fieldName)) {
            currentSet.delete(fieldName);
        } else {
            currentSet.add(fieldName);
        }
        setSelectedFields({
            ...selectedFields,
            [objectName]: currentSet
        });
    };

    const toggleObjectExpand = (objectName: string) => {
        const newSet = new Set(expandedObjects);
        if (newSet.has(objectName)) {
            newSet.delete(objectName);
        } else {
            newSet.add(objectName);
        }
        setExpandedObjects(newSet);
    };

    const selectAll = (objectName: string) => {
        const desc = objectDescribes[objectName];
        if (!desc) return;
        const allFields = desc.fields.map(f => f.name);
        setSelectedFields({
            ...selectedFields,
            [objectName]: new Set(allFields)
        });
    };

    const deselectAll = (objectName: string) => {
        setSelectedFields({
            ...selectedFields,
            [objectName]: new Set(['Id']) // Always keep Id
        });
    };

    const getFinalFields = (): Record<string, string[]> => {
        const finalSelectedFields: Record<string, string[]> = {};
        Object.keys(selectedFields).forEach(key => {
            finalSelectedFields[key] = Array.from(selectedFields[key]);
        });
        return finalSelectedFields;
    };

    const handleNext = () => {
        if (!config) return;
        const newConfig = { ...config, selectedFields: getFinalFields() };
        localStorage.setItem('migrationConfig', JSON.stringify(newConfig));
        window.location.href = '/select-records';
    };

    const handleSaveTemplate = () => {
        if (!config || !templateName.trim()) return;
        saveTemplate(templateName.trim(), {
            rootObject: config.rootObject,
            children: config.children,
            selectedFields: getFinalFields(),
        });
        setTemplateName('');
        setShowSaveModal(false);
        setSavedBanner(templateName.trim());
        setTimeout(() => setSavedBanner(null), 3000);
    };

    if (loading || !config) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" /></div>;
    }

    const objectList = getAllObjectNames({ rootObject: config.rootObject, children: config.children });

    return (
        <>
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Select Fields</h1>
                        <p className="text-gray-500">Choose which fields to migrate for each object.</p>
                    </div>
                    <button
                        onClick={() => setShowSaveModal(true)}
                        className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-100 rounded-lg flex items-center gap-2 border border-gray-300"
                    >
                        <BookmarkPlus size={16} /> Save as Template
                    </button>
                </div>

                {savedBanner && (
                    <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                        <BookmarkPlus size={16} />
                        Template &quot;{savedBanner}&quot; saved successfully.
                    </div>
                )}

                <div className="space-y-4">
                    {objectList.map(objName => {
                        const describe = objectDescribes[objName];
                        const isExpanded = expandedObjects.has(objName);
                        const selectedCount = selectedFields[objName]?.size || 0;
                        const totalCount = describe?.fields.length || 0;

                        return (
                            <div key={objName} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                <div
                                    className="p-4 bg-gray-50 cursor-pointer flex items-center justify-between hover:bg-gray-100 transition-colors"
                                    onClick={() => toggleObjectExpand(objName)}
                                >
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                                        <div>
                                            <h3 className="font-semibold text-lg text-gray-800">{objName}</h3>
                                            <p className="text-xs text-blue-600 font-medium">{selectedCount} of {totalCount} fields selected</p>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t">
                                        <div className="flex gap-2 mb-4 text-sm">
                                            <button
                                                onClick={() => selectAll(objName)}
                                                className="text-blue-600 hover:underline"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={() => deselectAll(objName)}
                                                className="text-gray-500 hover:text-gray-700 hover:underline"
                                            >
                                                Deselect All
                                            </button>
                                        </div>

                                        {describe ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {describe.fields.map(field => {
                                                    const isSelected = selectedFields[objName]?.has(field.name);
                                                    return (
                                                        <div
                                                            key={field.name}
                                                            className={cn(
                                                                "flex items-center gap-2 p-2 rounded cursor-pointer border transition-all",
                                                                isSelected ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50 border-transparent"
                                                            )}
                                                            onClick={() => toggleField(objName, field.name)}
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare size={18} className="text-blue-600 flex-shrink-0" />
                                                            ) : (
                                                                <Square size={18} className="text-gray-300 flex-shrink-0" />
                                                            )}
                                                            <div className="overflow-hidden">
                                                                <p className="text-sm font-medium truncate text-gray-700" title={field.label}>{field.label}</p>
                                                                <p className="text-xs text-gray-400 font-mono truncate" title={field.name}>{field.name}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-8 flex justify-center">
                                                <Loader2 className="animate-spin text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-3 pt-6">
                    <Link href="/select-objects">
                        <button className="px-6 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg flex items-center gap-2">
                            <ArrowLeft size={18} /> Back
                        </button>
                    </Link>
                    <button
                        onClick={handleNext}
                        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    >
                        Next: Select Records <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </main>

        {/* Save Template Modal */}

        {showSaveModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-lg text-gray-900">Save as Template</h3>
                        <button onClick={() => setShowSaveModal(false)} className="p-2 hover:bg-gray-200 rounded-full">
                            <XCircle size={20} className="text-gray-500" />
                        </button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Account with Contacts"
                                className="w-full p-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            Saves the current object hierarchy and all field selections as a reusable template.
                        </p>
                    </div>
                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                        <button
                            onClick={() => setShowSaveModal(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveTemplate}
                            disabled={!templateName.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <BookmarkPlus size={16} /> Save
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
