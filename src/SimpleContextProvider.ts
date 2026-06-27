import { ContextProvider } from './types';

export class SimpleContextProvider implements ContextProvider {
  constructor(private readonly context: Record<string, unknown>) {}

  getEagerProperties(): Record<string, unknown> {
    return this.context;
  }
}
