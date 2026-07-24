declare module 'asn1.js' {
  interface Asn1Node {
    seq(): Asn1Node;
    obj(...children: Asn1Node[]): Asn1Node;
    key(name: string): Asn1Node;
    explicit(tag: number): Asn1Node;
    optional(): Asn1Node;
    int(): Asn1Node;
    octstr(): Asn1Node;
    objid(): Asn1Node;
    bitstr(): Asn1Node;
  }

  interface DecodeOptions {
    partial?: boolean;
    track?: (path: string, start: number, end: number, type: string) => void;
  }

  interface PemOptions {
    label: string;
  }

  interface PartialResult<T> {
    result: T | null;
    errors: Error[];
  }

  class Entity<T = unknown> {
    constructor(name: string, body: (this: Asn1Node) => void);

    decode(
      data: Buffer,
      enc: 'der',
      options: DecodeOptions & { partial: true }
    ): PartialResult<T>;
    decode(
      data: string | Buffer,
      enc: 'pem',
      options: PemOptions & DecodeOptions & { partial: true }
    ): PartialResult<T>;
    decode(
      data: string | Buffer,
      enc: 'pem',
      options: PemOptions & DecodeOptions
    ): T;
    decode(
      data: Buffer,
      enc?: 'der',
      options?: DecodeOptions
    ): T;

    encode(data: T, enc: 'pem', options: PemOptions): string;
    encode(data: T, enc?: 'der'): Buffer<ArrayBuffer>;
  }

  export function define<T = unknown>(name: string, body: (this: Asn1Node) => void): Entity<T>;
}
