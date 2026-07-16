import type { SourceHash, InterpretedReference } from "@track-forge/contracts";

/**
 * In-memory cache for interpreted reference material.
 * Keyed by sourceHash so identical references skip LLM re-interpretation.
 */
export class ReferenceCache {
  private store = new Map<SourceHash, InterpretedReference>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /** Check if a hash is cached and still valid */
  has(hash: SourceHash): boolean {
    return this.store.has(hash);
  }

  /** Retrieve cached interpretation, or undefined */
  get(hash: SourceHash): InterpretedReference | undefined {
    return this.store.get(hash);
  }

  /** Store interpretation result */
  set(hash: SourceHash, value: InterpretedReference): void {
    if (this.store.size >= this.maxSize && !this.store.has(hash)) {
      const first = this.store.keys().next();
      if (!first.done) this.store.delete(first.value);
    }
    this.store.set(hash, value);
  }

  /** Clear all entries */
  clear(): void {
    this.store.clear();
  }

  /** Number of cached entries */
  get size(): number {
    return this.store.size;
  }
}
