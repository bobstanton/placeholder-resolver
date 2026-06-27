export class CompositeContextProvider {
    constructor(providers) {
        this.providers = providers;
    }
    async getEagerProperties() {
        const result = {};
        for (const provider of this.providers) {
            Object.assign(result, await provider.getEagerProperties());
        }
        return result;
    }
    getLazyProperties() {
        const merged = {};
        for (const provider of this.providers) {
            Object.assign(merged, provider.getLazyProperties?.());
        }
        return merged;
    }
}
//# sourceMappingURL=CompositeContextProvider.js.map