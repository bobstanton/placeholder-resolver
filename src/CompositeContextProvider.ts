import { ContextProvider } from './types';

export class CompositeContextProvider implements ContextProvider {
  constructor(private readonly providers: readonly ContextProvider[]) {}

  async getEagerProperties(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const provider of this.providers) {
      Object.assign(result, await provider.getEagerProperties());
    }
    return result;
  }

  getLazyProperties(): Record<string, () => Promise<unknown> | unknown> {
    const merged: Record<string, () => Promise<unknown> | unknown> = {};
    for (const provider of this.providers) {
      Object.assign(merged, provider.getLazyProperties?.());
    }
    return merged;
  }
}
