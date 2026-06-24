import { ConnectionCard } from '@/components/connection-card';
import { Database, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getSession } from '@/lib/session-store';

export default async function Home() {
  const cookieStore = await cookies();
  const sourceSessionId = cookieStore.get('sf_source_session')?.value;
  const targetSessionId = cookieStore.get('sf_target_session')?.value;

  const sourceSession = sourceSessionId ? getSession(sourceSessionId) : undefined;
  const targetSession = targetSessionId ? getSession(targetSessionId) : undefined;

  const sourceOrgName = sourceSession?.orgName;
  const targetOrgName = targetSession?.orgName;

  const sourceUsername = sourceSession?.username;
  const targetUsername = targetSession?.username;

  const isSourceConnected = !!sourceSession;
  const isTargetConnected = !!targetSession;
  const readyToMigrate = isSourceConnected && isTargetConnected;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
            <ArrowRightLeft className="text-blue-600 w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Salesforce Data Migrator</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Securely migrate objects and relationships between Salesforce environments with support for complex hierarchies.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <ConnectionCard
            title="Source Organization"
            type="source"
            isConnected={isSourceConnected}
            orgName={sourceOrgName}
            username={sourceUsername}
            icon={<Database size={24} />}
          />
          <ConnectionCard
            title="Target Organization"
            type="target"
            isConnected={isTargetConnected}
            orgName={targetOrgName}
            username={targetUsername}
            icon={<ShieldCheck size={24} />}
          />
        </div>

        <div className="flex justify-center pt-8">
          {readyToMigrate ? (
            <Link href="/select-objects">
              <button className="bg-slate-900 text-white text-lg px-8 py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
                Continue to Object Selection <ArrowRightLeft size={20} />
              </button>
            </Link>
          ) : (
            <div className="text-gray-400 italic">Connect both organizations to proceed</div>
          )}
        </div>
      </div>
    </main>
  );
}
