'use client';

import { useState, useEffect } from 'react';
import { getRecords } from '@/app/actions/metadata';
import { Loader2, ArrowRight, ArrowLeft, Search, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MigrationConfig } from '@/lib/migration-engine/types';

interface RecordItem {
    Id: string;
    Name: string;
    CreatedDate: string;
}

export default function SelectRecordsPage() {
    const [config, setConfig] = useState<MigrationConfig | null>(null);
    const [records, setRecords] = useState<RecordItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        // Load config from local storage
        const saved = localStorage.getItem('migrationConfig');
        if (saved) {
            setConfig(JSON.parse(saved));
        } else {
            // Redirect if no config
            window.location.href = '/select-objects';
        }
    }, []);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (!config) return;

        async function fetchRecords() {
            setLoading(true);
            try {
                const results = await getRecords(config!.rootObject, debouncedSearch, 50);
                setRecords(results);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchRecords();
    }, [config, debouncedSearch]);

    const toggleRecord = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleNext = () => {
        if (!config) return;

        // Update config with selected IDs
        const newConfig = {
            ...config,
            sourceRecordIds: Array.from(selectedIds)
        };
        localStorage.setItem('migrationConfig', JSON.stringify(newConfig));
        window.location.href = '/migrate';
    };

    if (!config) return null;

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto space-y-6">

                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Select {config.rootObject} Records</h1>
                            <p className="text-gray-500">Choose which records to migrate (optional, select none to migrate all)</p>
                        </div>
                        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                            {selectedIds.size} Selected
                        </div>
                    </div>

                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={`Search ${config.rootObject} by Name...`}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center p-12">
                                <Loader2 className="animate-spin text-blue-600" />
                            </div>
                        ) : records.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-3 w-12 text-center">
                                            {/* Select All could go here logic permitting */}
                                        </th>
                                        <th className="p-3 font-medium text-gray-700">Name / ID</th>
                                        <th className="p-3 font-medium text-gray-700">Created Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {records.map(rec => {
                                        const isSelected = selectedIds.has(rec.Id);
                                        return (
                                            <tr
                                                key={rec.Id}
                                                className={cn("hover:bg-gray-50 cursor-pointer transition-colors", isSelected && "bg-blue-50")}
                                                onClick={() => toggleRecord(rec.Id)}
                                            >
                                                <td className="p-3 text-center">
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                                        isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                                    )}>
                                                        {isSelected && <CheckCircle size={14} className="text-white" />}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-medium text-gray-900">{rec.Name}</td>
                                                <td className="p-3 text-gray-500">{new Date(rec.CreatedDate).toLocaleDateString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-12 text-center text-gray-500">
                                No records found matching "{searchQuery}"
                            </div>
                        )}
                    </div>

                    <div className="mt-4 text-xs text-gray-400 text-center">
                        Showing top 50 matches. Search to find specific records.
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Link href="/select-fields">
                        <button className="px-6 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg flex items-center gap-2">
                            <ArrowLeft size={18} /> Back
                        </button>
                    </Link>
                    <button
                        onClick={handleNext}
                        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    >
                        {selectedIds.size > 0 ? `Migrate ${selectedIds.size} Records` : 'Migrate All Records'} <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </main>
    );
}
