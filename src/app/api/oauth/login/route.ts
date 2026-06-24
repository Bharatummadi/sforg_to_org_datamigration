import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client } from '@/lib/salesforce/client';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/utils';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'source' or 'target'
    const env = searchParams.get('env') || 'production'; // 'production' or 'sandbox'

    if (!type || (type !== 'source' && type !== 'target')) {
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/oauth/callback`;

    const loginUrl = env === 'sandbox' ? 'https://test.salesforce.com' : 'https://login.salesforce.com';

    const oauth2 = createOAuth2Client({
        clientId: process.env.SF_CLIENT_ID || '', // We need env vars for this
        clientSecret: process.env.SF_CLIENT_SECRET || '',
        redirectUri,
        loginUrl,
    });

    // PKCE Generation
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    // Store verifier and environment in cookie
    const cookieStore = await cookies();
    cookieStore.set(`sf_verifier_${type}`, verifier, { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 600 });
    cookieStore.set(`sf_env_${type}`, env, { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 600 });

    // State parameter can pass the type so we know which one we are connecting in callback
    // Append code_challenge to the URL manually or via options if supported.
    // JSForce getAuthorizationUrl supports 'extra' params via options
    const authUrl = oauth2.getAuthorizationUrl({
        scope: 'api refresh_token web',
        state: type,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'login'
    } as any); // cast to any to allow extra params if types are strict

    return NextResponse.redirect(authUrl);
}
