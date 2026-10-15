// This browser's key pair (ADR-022). The private half is made non-extractable and never leaves
// WebCrypto; the pair is kept in IndexedDB so the browser keeps its id across visits.

export type Identity = { keys: CryptoKeyPair; publicKey: string; id: string };

const algorithm = { name: "ECDSA", namedCurve: "P-256" } as const;
const signing = { name: "ECDSA", hash: "SHA-256" } as const;

let mine: Promise<Identity> | null = null;

/** This browser's identity, made on first use. */
export function identity(): Promise<Identity> {
  mine ??= loadOrMake().then(describe);
  return mine;
}

async function loadOrMake(): Promise<CryptoKeyPair> {
  const stored = await readStored().catch(() => null);
  if (stored) return stored;
  const keys = await crypto.subtle.generateKey(algorithm, false, ["sign", "verify"]);
  try {
    await writeStored(keys);
    return keys;
  } catch {
    // Another tab stored a key first: use that one. Without storage at all, the key lasts this visit.
    return (await readStored().catch(() => null)) ?? keys;
  }
}

async function describe(keys: CryptoKeyPair): Promise<Identity> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  return { keys, publicKey: toBase64url(raw), id: await idOf(raw) };
}

/** A browser's id: base64url of the first 16 bytes of SHA-256 of its raw public key. */
export async function idOf(rawPublicKey: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", rawPublicKey as BufferSource));
  return toBase64url(hash.subarray(0, 16));
}

/** Rejects unless the bytes are a P-256 public key. */
export async function checkPublicKey(raw: Uint8Array): Promise<void> {
  await crypto.subtle.importKey("raw", raw as BufferSource, algorithm, true, ["verify"]);
}

export async function sign(keys: CryptoKeyPair, bytes: Uint8Array): Promise<string> {
  return toBase64url(new Uint8Array(await crypto.subtle.sign(signing, keys.privateKey, bytes as BufferSource)));
}

/** False for a malformed key or signature as well as a wrong one. */
export async function verify(publicKey: string, bytes: Uint8Array, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", fromBase64url(publicKey) as BufferSource, algorithm, false, ["verify"]);
    return await crypto.subtle.verify(signing, key, fromBase64url(signature) as BufferSource, bytes as BufferSource);
  } catch {
    return false;
  }
}

// Storage

const database = "openbattle";
const store = "keys";
const entry = "browser";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStored(): Promise<CryptoKeyPair | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(entry);
    request.onsuccess = () => resolve((request.result as CryptoKeyPair | undefined) ?? null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close()) as Promise<CryptoKeyPair | null>;
}

async function writeStored(keys: CryptoKeyPair): Promise<void> {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    // add, not put: if another tab made a key first, keep that one.
    tx.objectStore(store).add(keys, entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

// Encoding

export function toBase64url(bytes: Uint8Array): string {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function fromBase64url(text: string): Uint8Array {
  const plain = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(plain, (c) => c.charCodeAt(0));
}
