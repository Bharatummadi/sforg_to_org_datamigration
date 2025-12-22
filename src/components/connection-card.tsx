'use client';

import { ReactNode, useState } from 'react';
import { CheckCircle, XCircle, Globe, Box } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming you have a utils file
import { disconnect } from '@/app/actions/auth';

interface ConnectionCardProps {
    title: string;
    type: 'source' | 'target';
    isConnected: boolean;
    username?: string;
    orgName?: string;
    icon: ReactNode;
}

export function ConnectionCard({ title, type, isConnected, username, orgName, icon }: ConnectionCardProps) {
    const [env, setEnv] = useState<'production' | 'sandbox'>('production');

    const handleConnect = () => {
        window.location.href = `/api/oauth/login?type=${type}&env=${env}`;
    };

    const handleDisconnect = async () => {
        try {
            await disconnect(type);
            // Optional: Reload to ensure full state reset if client-side cache persists
            // But revalidatePath in action handles the server data.
            // A router.refresh() would be cleaner than reload, but reload is safe.
            window.location.reload();
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    return (
        <div className={cn(
            "p-6 rounded-xl border transition-all duration-200",
            isConnected ? "bg-green-50 border-green-200" : "bg-white border-gray-200 hover:shadow-md"
        )}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", isConnected ? "bg-green-100 test-green-600" : "bg-gray-100 text-gray-500")}>
                        {icon}
                    </div>
                    <h3 className="font-semibold text-lg">{title}</h3>
                </div>
                {isConnected ? (
                    <CheckCircle className="text-green-500" size={20} />
                ) : (
                    <XCircle className="text-gray-300" size={20} />
                )}
            </div>

            <div className="space-y-4">
                {isConnected ? (
                    <div>
                        <p className="text-sm text-gray-500">Connected Organization</p>
                        <p className="font-medium text-gray-900 truncate text-lg">{orgName || 'Salesforce Org'}</p>
                        <p className="text-s text-gray-400 mt-1">Logged in as {username || 'User'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-500">Select Environment</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setEnv('production')}
                                className={cn("flex-1 py-2 px-3 rounded-md text-sm border flex items-center justify-center gap-2", env === 'production' ? "bg-blue-50 border-blue-500 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
                            >
                                <Globe size={16} /> Production
                            </button>
                            <button
                                onClick={() => setEnv('sandbox')}
                                className={cn("flex-1 py-2 px-3 rounded-md text-sm border flex items-center justify-center gap-2", env === 'sandbox' ? "bg-blue-50 border-blue-500 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
                            >
                                <Box size={16} /> Sandbox
                            </button>
                        </div>
                    </div>
                )}

                <button
                    onClick={isConnected ? handleDisconnect : handleConnect}
                    className={cn(
                        "w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors",
                        isConnected
                            ? "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-red-600"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                    )}
                >
                    {isConnected ? 'Disconnect' : `Connect to ${env === 'production' ? 'Production' : 'Sandbox'}`}
                </button>
            </div>
        </div>
    );
}
