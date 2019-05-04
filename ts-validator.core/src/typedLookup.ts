
const defaultCombine = <TValue>(x: TValue, y: TValue) => y;

export class TypedLookup<TKey, TValue>{
    private _keys: TKey[] = []
    private _values: TValue[] = []

    /** Returns true if value already exists, otherwise false. If choose is unspecified, overwries the old value */
    add (key: TKey, value: TValue, choose?: (x: TValue, y: TValue) => TValue) {
        var  k = this._keys.indexOf(key);
        if (k === -1) {
            this._keys.push(key);
            this._values.push(value);

            return {
                isNew: true,
                value
            };
        }

        if (!choose) choose = defaultCombine;

        this._values[k] = choose(this._values[k], value);
        return {
            isNew: false,
            value: this._values[k]
        };
    }

    /** Gets the value for a key, or undefined */
    tryGet (key: TKey): TValue | undefined {
        var  k = this._keys.indexOf(key);
        return k === -1
            ? undefined
            : this._values[k];
    }
}