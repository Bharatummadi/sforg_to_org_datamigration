import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

export function generateCodeChallenge(verifier: string) {
  return base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
}

function base64URLEncode(str: Buffer) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
