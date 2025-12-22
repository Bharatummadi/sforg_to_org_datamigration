'use client';

import { useState, useEffect } from 'react';
import { getSourceObjects, getObjectDetails } from '@/app/actions/metadata';
import { SalesforceObject, ObjectDescribe } from '@/lib/migration-engine/types';
import { Loader2, ChevronRight, Layers, ArrowRight, XCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils'; // Assuming utils exists

export default function ObjectSelectionPage() {
    const [objects, setObjects] = useState<SalesforceObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [rootObject, setRootObject] = useState<string | null>(null);
    const [rootDescribe, setRootDescribe] = useState<ObjectDescribe | null>(null);
    const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
    const [selectedGrandChildren, setSelectedGrandChildren] = useState<Record<string, string[]>>({});
    const [configuringChild, setConfiguringChild] = useState<string | null>(null);
    const [childDescribe, setChildDescribe] = useState<ObjectDescribe | null>(null);
    const [loadingChildSchema, setLoadingChildSchema] = useState(false);

    const [loadingSchema, setLoadingSchema] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [childSearchQuery, setChildSearchQuery] = useState('');

    const filteredObjects = objects.filter(obj =>
        obj.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obj.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredChildren = rootDescribe?.childRelationships.filter(child =>
        child.childSObject.toLowerCase().includes(childSearchQuery.toLowerCase()) ||
        child.field.toLowerCase().includes(childSearchQuery.toLowerCase())
    ) || [];

    useEffect(() => {
        async function fetchObjects() {
            try {
                const objs = await getSourceObjects();
                // Sort alphabetically
                setObjects(objs.sort((a, b) => a.label.localeCompare(b.label)));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchObjects();
    }, []);

    const handleRootSelect = async (objName: string) => {
        setRootObject(objName);
        setLoadingSchema(true);
        setChildSearchQuery(''); // Reset child search
        try {
            const details = await getObjectDetails(objName);
            setRootDescribe(details);
            setSelectedChildren(new Set()); // Reset children
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingSchema(false);
        }
    };

    const toggleChild = (childName: string) => {
        const newSet = new Set(selectedChildren);
        if (newSet.has(childName)) {
            newSet.delete(childName);
            // Also cleanup grandchildren
            const newGrand = { ...selectedGrandChildren };
            delete newGrand[childName];
            setSelectedGrandChildren(newGrand);
        } else {
            newSet.add(childName);
        }
        setSelectedChildren(newSet);
    };

    const handleConfigureChild = async (childName: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent toggling selection
        setConfiguringChild(childName);
        setLoadingChildSchema(true);
        try {
            const details = await getObjectDetails(childName);
            setChildDescribe(details);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingChildSchema(false);
        }
    };

    const toggleGrandChild = (grandChildName: string) => {
        if (!configuringChild) return;
        const current = selectedGrandChildren[configuringChild] || [];
        const newSet = new Set(current);
        if (newSet.has(grandChildName)) {
            newSet.delete(grandChildName);
        } else {
            newSet.add(grandChildName);
        }
        setSelectedGrandChildren({
            ...selectedGrandChildren,
            [configuringChild]: Array.from(newSet)
        });
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 h-[85vh]">

                {/* Left Column: Object List */}
                <div className="col-span-4 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <h2 className="font-semibold text-gray-700">Select Root Object</h2>
                        <input
                            type="text"
                            placeholder="Search objects..."
                            className="mt-2 w-full p-2 border rounded-md text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {filteredObjects.map(obj => (
                            <button
                                key={obj.name}
                                onClick={() => handleRootSelect(obj.name)}
                                className={cn(
                                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex justify-between items-center group",
                                    rootObject === obj.name ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-50 text-gray-600"
                                )}
                            >
                                {obj.label}
                                {rootObject === obj.name && <ChevronRight size={16} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Column: Hierarchy Configuration */}
                <div className="col-span-8 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden">
                    {!rootObject ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <Layers size={48} className="mb-4 opacity-50" />
                            <p>Select an object from the list to begin</p>
                        </div>
                    ) : loadingSchema ? (
                        <div className="flex-1 flex items-center justify-center text-blue-600">
                            <Loader2 className="animate-spin mr-2" /> Loading properties...
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="p-6 border-b flex-none">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                                        <Layers size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{rootDescribe?.name}</h2>
                                        <p className="text-sm text-gray-500">Root Object</p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Available Related Objects (Children)</h3>
                                    <input
                                        type="text"
                                        placeholder="Search related objects..."
                                        className="w-full p-2 border rounded-md text-sm"
                                        value={childSearchQuery}
                                        onChange={(e) => setChildSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid grid-cols-2 gap-3">
                                    {filteredChildren.map((child, idx) => {
                                        const isSelected = selectedChildren.has(child.childSObject);
                                        const grandChildCount = selectedGrandChildren[child.childSObject]?.length || 0;

                                        return (
                                            <div
                                                key={`${child.childSObject}-${child.field}-${idx}`}
                                                className={cn(
                                                    "p-3 border rounded-lg transition-all hover:border-blue-300 relative group",
                                                    isSelected ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500" : "bg-white border-gray-200"
                                                )}
                                            >
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() => toggleChild(child.childSObject)}
                                                >
                                                    <div className="font-medium text-sm flex justify-between">
                                                        {child.childSObject}
                                                        {isSelected && (
                                                            <button
                                                                onClick={(e) => handleConfigureChild(child.childSObject, e)}
                                                                className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200"
                                                            >
                                                                {grandChildCount > 0 ? `${grandChildCount} Children` : 'Add Children'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">via {child.field}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {filteredChildren.length === 0 && (
                                        <p className="text-sm text-gray-500 italic col-span-2">No child relationships found matching "{childSearchQuery}".</p>
                                    )}
                                </div>
                            </div>

                            {/* Modal for Grandchildren */}
                            {configuringChild && (
                                <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
                                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900">Configure {configuringChild}</h3>
                                                <p className="text-sm text-gray-500">Select children of {configuringChild} to migrate</p>
                                            </div>
                                            <button onClick={() => setConfiguringChild(null)} className="p-2 hover:bg-gray-200 rounded-full">
                                                <XCircle size={20} className="text-gray-500" />
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4">
                                            {loadingChildSchema ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <Loader2 className="animate-spin text-blue-600 mb-2" />
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {childDescribe?.childRelationships.map((grand, gIdx) => {
                                                        const isGrandSelected = (selectedGrandChildren[configuringChild] || []).includes(grand.childSObject);
                                                        return (
                                                            <div
                                                                key={`${grand.childSObject}-${gIdx}`}
                                                                onClick={() => toggleGrandChild(grand.childSObject)}
                                                                className={cn(
                                                                    "p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-300",
                                                                    isGrandSelected ? "bg-purple-50 border-purple-500 ring-1 ring-purple-500" : "bg-white border-gray-200"
                                                                )}
                                                            >
                                                                <div className="font-medium text-sm">{grand.childSObject}</div>
                                                                <div className="text-xs text-gray-500">via {grand.field}</div>
                                                            </div>
                                                        )
                                                    })}
                                                    {childDescribe?.childRelationships.length === 0 && (
                                                        <p className="col-span-2 text-center text-gray-500 py-8">No child objects found for {configuringChild}.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                                            <button
                                                onClick={() => setConfiguringChild(null)}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Persistent Footer */}
                            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 flex-none sticky bottom-0">
                                <Link href="/">
                                    <button className="px-6 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Back</button>
                                </Link>
                                <button
                                    disabled={!rootObject}
                                    onClick={() => {
                                        // Construct Recursive Config
                                        const childrenConfig = Array.from(selectedChildren).map(childName => ({
                                            objectName: childName,
                                            children: (selectedGrandChildren[childName] || []).map(grandName => ({
                                                objectName: grandName,
                                                children: []
                                            }))
                                        }));

                                        const config = {
                                            rootObject,
                                            children: childrenConfig,
                                            selectedFields: {} // Default to auto-select
                                        };
                                        localStorage.setItem('migrationConfig', JSON.stringify(config));
                                        window.location.href = '/select-fields';
                                    }}
                                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Next: Select Fields <ArrowRight size={18} />
                                </button>
                            </div>
                        </>
                    )}
                </div>

            </div>
        </main>
    );
}
