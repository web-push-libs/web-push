declare module 'http_ece' {
  import type { ECDH } from 'node:crypto';

  type EncodedBuffer = Buffer<ArrayBuffer> | string;

  interface Params {
    version?: 'aes128gcm' | 'aesgcm';
    rs?: number | string;
    salt?: EncodedBuffer;
    keyid?: EncodedBuffer;
    key?: EncodedBuffer;
    privateKey?: ECDH;
    keymap?: Record<string, EncodedBuffer>;
    keylabel?: string;
    dh?: EncodedBuffer;
    authSecret?: EncodedBuffer;
    pad?: number | string;
  }

  type KeyLookupCallback = (keyid: EncodedBuffer) => Buffer<ArrayBuffer> | undefined;

  export function encrypt(
    buffer: Buffer<ArrayBuffer>,
    params: Params,
    keyLookupCallback?: KeyLookupCallback
  ): Buffer<ArrayBuffer>;

  export function decrypt(
    buffer: Buffer<ArrayBuffer>,
    params: Params,
    keyLookupCallback?: KeyLookupCallback
  ): Buffer<ArrayBuffer>;
}
