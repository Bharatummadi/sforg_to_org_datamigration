import { Connection, OAuth2 } from 'jsforce';

export const SF_VERSION = '60.0';

export interface SFConnectionParams {
    accessToken: string;
    instanceUrl: string;
}

export interface SFOAuthParams {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    loginUrl?: string;
}

/**
 * Creates a JSforce connection from a valid access token and instance URL.
 */
export function createConnection({ accessToken, instanceUrl }: SFConnectionParams) {
    return new Connection({
        accessToken,
        instanceUrl,
        version: SF_VERSION,
    });
}

/**
 * Creates an OAuth2 client for handling the login flow.
 */
export function createOAuth2Client(params: SFOAuthParams) {
    return new OAuth2({
        loginUrl: params.loginUrl || 'https://login.salesforce.com',
        clientId: params.clientId,
        clientSecret: params.clientSecret,
        redirectUri: params.redirectUri,
    });
}

/**
 * Helper to validate a connection by querying the User info.
 */
export async function validateConnection(conn: Connection) {
    try {
        const identity = await conn.identity();
        return identity;
    } catch (error) {
        console.error('Failed to validate connection:', error);
        throw error;
    }
}
