type ObserverScope = Element | (() => Element | null);

type ObserverOptions = MutationObserverInit & {
  attributeFilter?: string[];
};

type ObserverListener = {
  id: string;
  selectors?: string[];
  callback: (mutations: MutationRecord[]) => void;
  options?: ObserverOptions;
  scope?: ObserverScope;
};

const normalizeSelectors = (selectors?: string | string[]): string[] | undefined => {
  if (!selectors) return undefined;
  return Array.isArray(selectors) ? selectors : [selectors];
};

const elementMatchesSelectors = (node: Node, selectors: string[]): boolean => {
  if (!(node instanceof Element)) return false;
  for (const selector of selectors) {
    try {
      if (node.matches(selector)) return true;
      if (node.closest(selector)) return true;
      if (node.querySelector(selector)) return true;
    } catch {
      // Ignore invalid selectors
    }
  }
  return false;
};

export class SharedObserverPool {
  private observer: MutationObserver | null = null;
  private listeners = new Map<string, ObserverListener>();
  private pending = new Map<string, MutationRecord[]>();
  private flushScheduled = false;
  private nextId = 0;

  register(
    selectors: string | string[] | undefined,
    callback: (mutations: MutationRecord[]) => void,
    options?: ObserverOptions,
    scope?: ObserverScope
  ): () => void {
    const id = `listener-${++this.nextId}`;
    const entry: ObserverListener = {
      id,
      selectors: normalizeSelectors(selectors),
      callback,
      options,
      scope,
    };
    this.listeners.set(id, entry);
    this.ensureObserver();
    return () => {
      this.listeners.delete(id);
      this.pending.delete(id);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  disconnect(): void {
    if (this.observer) {
      try {
        this.observer.disconnect();
      } catch {}
      this.observer = null;
    }
  }

  private getRoot(): Element | null {
    return document.body || document.documentElement;
  }

  private ensureObserver(): void {
    const root = this.getRoot();
    if (!root) return;

    const options = this.computeObserverOptions();
    if (this.observer) {
      try {
        this.observer.disconnect();
      } catch {}
      this.observer.observe(root, options);
      return;
    }

    this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
    this.observer.observe(root, options);
  }

  private computeObserverOptions(): MutationObserverInit {
    let attributes = false;
    let childList = false;
    let characterData = false;

    for (const listener of this.listeners.values()) {
      if (!listener.options) {
        attributes = true;
        childList = true;
        break;
      }
      if (listener.options.attributes) attributes = true;
      if (listener.options.childList) childList = true;
      if (listener.options.characterData) characterData = true;
    }

    return {
      attributes,
      childList,
      characterData,
      subtree: true,
    };
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (this.listeners.size === 0) return;
    for (const listener of this.listeners.values()) {
      if (!this.shouldNotify(listener, mutations)) continue;
      const existing = this.pending.get(listener.id) || [];
      existing.push(...mutations);
      this.pending.set(listener.id, existing);
    }
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    const run = () => {
      this.flushScheduled = false;
      for (const [id, mutations] of this.pending.entries()) {
        const listener = this.listeners.get(id);
        if (!listener) continue;
        this.pending.delete(id);
        try {
          listener.callback(mutations);
        } catch (error) {
          console.error('[SharedObserverPool] Listener failed:', error);
        }
      }
    };
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  }

  private resolveScope(scope?: ObserverScope): Element | null {
    if (!scope) return null;
    return typeof scope === 'function' ? scope() : scope;
  }

  private shouldNotify(listener: ObserverListener, mutations: MutationRecord[]): boolean {
    const scope = this.resolveScope(listener.scope);

    for (const mutation of mutations) {
      if (listener.options) {
        if (mutation.type === 'attributes' && !listener.options.attributes) continue;
        if (mutation.type === 'childList' && !listener.options.childList) continue;
        if (mutation.type === 'characterData' && !listener.options.characterData) continue;
        if (
          mutation.type === 'attributes' &&
          listener.options.attributeFilter &&
          mutation.attributeName &&
          !listener.options.attributeFilter.includes(mutation.attributeName)
        ) {
          continue;
        }
      }

      if (scope && mutation.target instanceof Node && !scope.contains(mutation.target)) {
        continue;
      }

      if (!listener.selectors) {
        return true;
      }

      if (mutation.type === 'attributes' && elementMatchesSelectors(mutation.target, listener.selectors)) {
        return true;
      }

      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (elementMatchesSelectors(node, listener.selectors)) return true;
        }
        for (const node of mutation.removedNodes) {
          if (elementMatchesSelectors(node, listener.selectors)) return true;
        }
      }
    }

    return false;
  }
}

export const sharedObserverPool = new SharedObserverPool();
