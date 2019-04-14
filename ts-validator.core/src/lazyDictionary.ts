
const noValue = {};
export class LazyDictionary<TValue> {
    private values: {[key: string]: () => TValue} = {}

    /** Add an item to the dictionary if another item does not exist. Returns the added or existing item. Caches items after first evaluation */
    tryAdd(key: string, value: () => TValue) {
        if (this.values[key]) {
            return {
                key,
                value: this.values[key]
            };
        }

        let val: TValue = noValue as any;
        return {
            key,
            value: this.values[key] = function () {
                return val === noValue 
                    ? (val = value())
                    : val;
            }
        };
    }

    tryGet(key: string): (() => TValue) | null {
        return this.values[key] || null;
    }

    getLazy(key: string): () => TValue {
        return () => {
            const result = this.tryGetLazy(key)();
            if (result === undefined) throw this.buildKeyNotFoundError(key);

            return result;
        };
    }

    tryGetLazy(key: string): () => (TValue | undefined) {
        return () => {
            const result = this.values[key];
            if (!result) return undefined;

            return result();
        };
    }

    enumerate() {
        return Object
            .keys(this.values)
            .map(x => ({ key: x, value: this.values[x]() }));
    }

    toDictionary(): {[key: string]: TValue} {
        const result: {[key: string]: TValue} = {};
        Object
            .keys(this.values)
            .forEach(k => result[k] = this.values[k]());

        return result;
    }

    protected buildKeyNotFoundError(key: string) {
        return new Error(`Could not find value for key: ${key}.`);
    }
}