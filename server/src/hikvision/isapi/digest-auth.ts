import * as crypto from 'crypto';

export interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string; // MD5 | MD5-sess | SHA-256
}

export function parseWwwAuthenticate(header: string): DigestChallenge | null {
  if (!header || !/^digest\s/i.test(header)) return null;
  const value = header.replace(/^digest\s+/i, '');
  const out: Record<string, string> = {};
  // Manfiy quotalanmagan va quotalanganlarni bo'lish
  const re = /(\w+)\s*=\s*("([^"]*)"|([^,]*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const k = m[1];
    const v = m[3] !== undefined ? m[3] : (m[4] || '').trim();
    out[k] = v;
  }
  if (!out.realm || !out.nonce) return null;
  return {
    realm: out.realm,
    nonce: out.nonce,
    qop: out.qop,
    opaque: out.opaque,
    algorithm: out.algorithm || 'MD5',
  };
}

function hash(algo: string, input: string): string {
  const a = (algo || 'MD5').toUpperCase().replace('-SESS', '');
  const node = a === 'SHA-256' ? 'sha256' : 'md5';
  return crypto.createHash(node).update(input).digest('hex');
}

export interface BuildAuthOptions {
  username: string;
  password: string;
  method: string;
  uri: string;
  challenge: DigestChallenge;
  nc?: string; // hex 8 chars, e.g. 00000001
  cnonce?: string;
}

export function buildAuthorizationHeader(opts: BuildAuthOptions): string {
  const { username, password, method, uri, challenge } = opts;
  const algo = (challenge.algorithm || 'MD5').toUpperCase();
  const ha1Plain = `${username}:${challenge.realm}:${password}`;
  let HA1 = hash(algo, ha1Plain);
  const nc = opts.nc || '00000001';
  const cnonce = opts.cnonce || crypto.randomBytes(8).toString('hex');
  if (algo.endsWith('-SESS')) {
    HA1 = hash(algo, `${HA1}:${challenge.nonce}:${cnonce}`);
  }
  const HA2 = hash(algo, `${method}:${uri}`);

  let response: string;
  const qop = challenge.qop ? challenge.qop.split(',')[0].trim() : undefined;
  if (qop) {
    response = hash(algo, `${HA1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${HA2}`);
  } else {
    response = hash(algo, `${HA1}:${challenge.nonce}:${HA2}`);
  }

  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `algorithm=${algo}`,
    `response="${response}"`,
  ];
  if (qop) {
    parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  return `Digest ${parts.join(', ')}`;
}
