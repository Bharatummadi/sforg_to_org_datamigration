'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Terminal } from 'lucide-react';
import Link from 'next/link';

interface JobStatus {
    id: string;
    status: 'pending' | 'scanning' | 'migrating' | 'completed' | 'failed';
    logs: string[];
    startTime: number;
}

function MigrationContent() {
    const searchParams = useSearchParams();
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<JobStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-start or manual start?
    useEffect(() => {
        const startMigration = async () => {
            const configStr = localStorage.getItem('migrationConfig');
            if (!configStr) {
                setError('No configuration found. Please go back and select objects.');
                return;
            }

            try {
                const config = JSON.parse(configStr);
                const res = await fetch('/api/migration/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config),
                });

                if (!res.ok) throw new Error('Failed to start migration');

                const data = await res.json();
                setJobId(data.jobId);
            } catch (err: any) {
                setError(err.message);
            }
        };

        if (!jobId && !error) {
            startMigration();
        }
    }, []); // Run on mount

    // Polling
    useEffect(() => {
        if (!jobId) return;
        if (status?.status === 'completed' || status?.status === 'failed') return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/migration/status?jobId=${jobId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data);
                }
            } catch (e) {
                console.error('Polling failed', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [jobId, status?.status]);

    // Scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [status?.logs]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Migration Status</h1>
                {status && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 capitalize">{status.status}</span>
                        {status.status === 'migrating' || status.status === 'scanning' ? <Loader2 className="animate-spin text-blue-500" /> : null}
                        {status.status === 'completed' ? <CheckCircle className="text-green-500" /> : null}
                        {status.status === 'failed' ? <XCircle className="text-red-500" /> : null}
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    {error}
                    <div className="mt-2">
                        <Link href="/select-objects" className="underline font-medium">Go back to setup</Link>
                    </div>
                </div>
            )}

            <div className="bg-black rounded-xl overflow-hidden shadow-lg border border-gray-800 font-mono text-sm min-h-[500px] flex flex-col">
                <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex items-center gap-2 text-gray-400">
                    <Terminal size={14} />
                    <span>console output</span>
                </div>
                <div className="p-4 text-green-400 overflow-y-auto flex-1 space-y-1 max-h-[600px]">
                    {status?.logs.map((log, i) => (
                        <div key={i} className="break-words">{log}</div>
                    ))}
                    <div ref={logsEndRef} />
                    {!status && !error && <div className="text-gray-500">Initializing migration engine...</div>}
                </div>
            </div>

            {status?.status === 'completed' && (
                <div className="flex justify-center">
                    <Link href="/">
                        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">Done</button>
                    </Link>
                </div>
            )}
        </div>
    );
}

export default function MigrationPage() {
    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin" /> Loading migration engine...</div>}>
                <MigrationContent />
            </Suspense>
        </main>
    );
}
