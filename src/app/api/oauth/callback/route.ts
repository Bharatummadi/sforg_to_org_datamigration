import { NextRequest, NextResponse } from 'next/server';
import { createConnection } from '@/lib/salesforce/client';
import { cookies } from 'next/headers';
import { saveSession } from '@/lib/session-store';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const type = searchParams.get('state'); // State holds the type
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
        return NextResponse.json({
            error: `Salesforce Error: ${error}`,
            description: errorDescription
        }, { status: 400 });
    }

    if (!code || !type) {
        return NextResponse.json({
            error: 'Missing code or type (state)',
            details: { code: !!code, state: searchParams.get('state'), all: Object.fromEntries(searchParams.entries()) }
        }, { status: 400 });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/oauth/callback`;

    // PKCE & Env: Retrieve verifier and env
    const cookieStore = await cookies();
    const verifier = cookieStore.get(`sf_verifier_${type}`)?.value;
    const env = cookieStore.get(`sf_env_${type}`)?.value || 'production';

    if (!verifier) {
        return NextResponse.json({ error: 'Missing code verifier. Please try logging in again.' }, { status: 400 });
    }

    try {
        // Exchange code for token MANUALLY to ensure PKCE params are sent
        // JSforce might not support code_verifier in requestToken easily
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: process.env.SF_CLIENT_ID || '',
            client_secret: process.env.SF_CLIENT_SECRET || '',
            redirect_uri: redirectUri,
            code_verifier: verifier
        });

        const loginUrl = env === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';
        // Allow override via env var if set, but respect user selection primarily if we want strict control
        // process.env.SF_LOGIN_URL override might be confusing if we have a selector. 
        // Let's rely on the selector.

        const tokenEndpoint = `${loginUrl}/services/oauth2/token`;

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('Token Exchange Failed:', errBody);
            return NextResponse.json({ error: 'Failed to exchange token', details: errBody }, { status: response.status });
        }

        const userInfo = await response.json();

        let orgName: string | undefined;
        let username: string | undefined;

        // Fetch Org Name & Username
        try {
            const conn = createConnection({ accessToken: userInfo.access_token, instanceUrl: userInfo.instance_url });

            // Parallel fetch: Org Name & Identity
            const [orgResult, identity] = await Promise.all([
                conn.query('SELECT Name, OrganizationType FROM Organization LIMIT 1') as unknown as Promise<any>,
                conn.identity()
            ]);

            if (orgResult.records && orgResult.records.length > 0) {
                orgName = orgResult.records[0].Name;
            }

            if (identity && identity.username) {
                username = identity.username;
            }

        } catch (orgErr) {
            console.error('Failed to fetch Org Info / Identity:', orgErr);
            // Don't fail the whole login if this fails
        }

        // Store full session server-side; put only the short ID in the cookie
        const sessionId = saveSession({
            accessToken: userInfo.access_token,
            instanceUrl: userInfo.instance_url,
            orgName,
            username,
        });

        // Delete old large token cookies if they exist
        cookieStore.delete(`sf_${type}_access_token`);
        cookieStore.delete(`sf_${type}_instance_url`);
        cookieStore.delete(`sf_${type}_org_name`);
        cookieStore.delete(`sf_${type}_username`);

        cookieStore.set(`sf_${type}_session`, sessionId, { secure: true, httpOnly: true, path: '/' });

        // Clean up verifier
        cookieStore.delete(`sf_verifier_${type}`);
        cookieStore.delete(`sf_env_${type}`);

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/`);
    } catch (error) {
        console.error('OAuth Error:', error);
        return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
    }
}
