import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JobManager } from '@/lib/migration-engine/job-manager';
import { Migrator } from '@/lib/migration-engine/migrator';
import { MigrationConfig } from '@/lib/migration-engine/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { rootObject, children, selectedFields, sourceRecordIds } = body;

        const cookieStore = await cookies();
        const sourceToken = cookieStore.get('sf_source_access_token')?.value;
        const sourceInstance = cookieStore.get('sf_source_instance_url')?.value;
        const targetToken = cookieStore.get('sf_target_access_token')?.value;
        const targetInstance = cookieStore.get('sf_target_instance_url')?.value;

        if (!sourceToken || !sourceInstance || !targetToken || !targetInstance) {
            return NextResponse.json({ error: 'Missing source or target connection' }, { status: 401 });
        }

        const config: MigrationConfig = {
            sourceAccessToken: sourceToken,
            sourceInstanceUrl: sourceInstance,
            targetAccessToken: targetToken,
            targetInstanceUrl: targetInstance,
            rootObject,
            children: children || [],
            selectedFields: selectedFields || {},
            sourceRecordIds: sourceRecordIds || [],
        };

        const jobId = crypto.randomUUID();
        JobManager.createJob(jobId);

        // Run migration asynchronously
        const migrator = new Migrator(config, (log) => JobManager.addLog(jobId, log));

        // We catch errors inside the async execution to update job status
        migrator.run().then(() => {
            JobManager.updateStatus(jobId, 'completed');
            JobManager.addLog(jobId, 'Job finished successfully.');
        }).catch((err) => {
            console.error('Migration failed', err);
            JobManager.updateStatus(jobId, 'failed');
            JobManager.addLog(jobId, `Job failed: ${err.message}`);
        });

        JobManager.updateStatus(jobId, 'scanning'); // Initial status

        return NextResponse.json({ jobId });
    } catch (error) {
        console.error('Failed to start migration', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
