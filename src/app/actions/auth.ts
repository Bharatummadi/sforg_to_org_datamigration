'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function disconnect(type: 'source' | 'target') {
    const cookieStore = await cookies();

    // Delete all relevant cookies for this type
    cookieStore.delete(`sf_${type}_access_token`);
    cookieStore.delete(`sf_${type}_instance_url`);
    cookieStore.delete(`sf_${type}_org_name`);
    cookieStore.delete(`sf_${type}_username`);

    // Revalidate the home page to reflect changes
    revalidatePath('/');

    return { success: true };
}
