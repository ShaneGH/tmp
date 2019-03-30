
const noValue = {};
export abstract class LazyDictionary<TKey, TValue> {
    private values: {[key: string]: () => TValue} = {}

    /** Add an item to the dictionary if another item does not exist. Returns the added or existing item or the */
    tryAdd(keyBase: TKey, value: (key: string) => TValue) {
        const key = this.buildKey(keyBase);
        if (this.values[key]) {
            return this.values[key];
        }

        let val: TValue = noValue as any;
        return this.values[key] = function () {
            return val === noValue 
                ? (val = value(key))
                : val;
        };
    }

    tryGet(keyBase: TKey): (() => TValue) | undefined {
        const key = this.buildKey(keyBase);
        return this.values[key] || undefined;
    }

    getLazy(keyBase: TKey): () => TValue {
        return () => {
            const result = this.getLazy(keyBase);
            if (!result) throw this.buildKeyNotFoundError(keyBase);

            return result();
        };
    }

    tryGetLazy(keyBase: TKey): () => (TValue | undefined) {
        const key = this.buildKey(keyBase);
        return () => {
            const result = this.values[key];
            if (!result) return undefined;

            return result();
        };
    }

    protected buildKeyNotFoundError(key: TKey) {
        return new Error(`Could not find value for key: ${this.buildKey(key)}.`);
    }

    protected abstract buildKey(key: TKey): string;
}