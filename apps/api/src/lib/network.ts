import dns from 'node:dns';
import net from 'node:net';

/**
 * Returns `true` when the given IPv4 or IPv6 address belongs to a
 * private / reserved / link-local range that must never be the target
 * of outbound webhook requests (SSRF protection).
 *
 * Covered ranges:
 *   IPv4: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 *          127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8
 *   IPv6: ::1, fc00::/7, fe80::/10
 */
export function isPrivateIP(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number) as [number, number, number, number];
    const [a, b] = parts;

    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 (current network)
    if (a === 0) return true;

    return false;
  }

  // IPv6
  const normalised = ip.toLowerCase();

  // ::1 (loopback)
  if (normalised === '::1') return true;

  // fc00::/7 — unique local addresses (fc00:: and fd00::)
  if (normalised.startsWith('fc') || normalised.startsWith('fd')) return true;

  // fe80::/10 — link-local
  if (normalised.startsWith('fe80')) return true;

  return false;
}

/**
 * Resolves the hostname extracted from `url` and throws if the resolved
 * IP address falls in a private/reserved range (SSRF guard).
 */
export async function assertPublicUrl(url: string): Promise<void> {
  const hostname = new URL(url).hostname;

  // Allow literal localhost only in non-production environments
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`SSRF blocked: webhook target resolves to a private address`);
    }
    return;
  }

  const { address } = await dns.promises.lookup(hostname);

  if (isPrivateIP(address)) {
    throw new Error(`SSRF blocked: webhook target resolves to a private address`);
  }
}
