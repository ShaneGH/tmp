import { PropertyKeyword, Property, Properties, LazyTypeReference, MultiType, MultiTypeCombinator, AliasedType, ArrayType } from "./types";
import { LazyDictionary } from "./lazyDictionary";

let kindBuilder = 0;
type WrapperKind<T> = {
    k: number
    v: T
}

function buildWrapperType<T>() {

    const kind = ++kindBuilder;
    return {
        build: function (value: T): WrapperKind<T> {
            return {
                k: kind,
                v: value
            };
        },

        is: function (value: WrapperKind<any>): value is WrapperKind<T> {
            return value && value.k === kind;
        }
    }
};

const arrayS = buildWrapperType<WrapperKind<any>>();

const aliasS = buildWrapperType<AliasTypeS>();
type AliasTypeS = {
    /** id */
    id: string,
    /** name */
    n: string,
    /** aliased */
    a: WrapperKind<any>
}

const propertyS = buildWrapperType<PropertyS>();
type PropertyS = {
    /** name */
    n: string,
    /** type */
    t: WrapperKind<any>
}

const propertiesS = buildWrapperType<PropertiesS>();
type PropertiesS = {
    /** properties */
    p: PropertyS[]
}

const propertyKeywordS = buildWrapperType<string>();

const MultiTypeS = buildWrapperType<MultiTypeS>();
type MultiTypeS = {
    /** types */
    t: WrapperKind<any>[],
    /** combinator */
    c: MultiTypeCombinator
}

const lazyTypeReferenceS = buildWrapperType<string>();

function serialize(value: AliasedType[]) {

    const result = new LazyDictionary<WrapperKind<any>>();
    function serializeSingle(value: any): WrapperKind<any> {

        function serProperty(p: Property) {
            return {
                n: p.name,
                t: serializeSingle(p.type)
            };
        }

        if (value instanceof ArrayType) {
            return  arrayS.build(serializeSingle(value.type));
        }
        
        if (value instanceof Property) {
            return propertyS.build(serProperty(value));
        }
        
        if (value instanceof Properties) {
            return propertiesS.build({
                p: value.properties.map(serProperty)
            });
        }
        
        if (value instanceof PropertyKeyword) {
            return propertyKeywordS.build(value.keyword);
        }
        
        if (value instanceof MultiType) {
            return MultiTypeS.build({
                c: value.combinator,
                t: value.types.map(serializeSingle)
            });
        }
        
        if (value instanceof LazyTypeReference) {
            toDo.push(value.getType());
            return lazyTypeReferenceS.build(value.id);
        }
        
        throw new Error("Serialization error 1");
    }

    const toDo = value.slice();
    for (var i = 0; i < toDo.length; i++) {
        const value = toDo[i];
        if (result.tryGet(value.id)) continue;
        
        result.tryAdd(value.id, () => aliasS.build({
            id: value.id,
            n: value.name,
            a: serializeSingle(value.aliases)
        }))();    // evaluate to serialize any nested types
    }
        
    return result.toDictionary();
}

function deserialize(values: {[key: string]: WrapperKind<any>}) {

    const result = new LazyDictionary<AliasedType>();
    function deserializeSingle(value: WrapperKind<any>): any {

        function dserProperty(p: PropertyS) {
            return new Property(
                p.n,
                deserializeSingle(p.t));
        }

        if (arrayS.is(value)) {
            return new ArrayType(
                deserializeSingle(value.v));
        }
        
        if (propertyS.is(value)) {
            return dserProperty(value.v);
        }
        
        if (propertiesS.is(value)) {
            return new Properties(
                value.v.p.map(dserProperty));
        }
        
        if (propertyKeywordS.is(value)) {
            const val = (PropertyKeyword as any)[value.v];
            if (!(val instanceof PropertyKeyword))
                throw new Error(`Invalid property keyword: ${value.v}`);
            
            return val;
        }
        
        if (MultiTypeS.is(value)) {
            return new MultiType(
                value.v.t.map(deserializeSingle),
                value.v.c);
        }
        
        if (lazyTypeReferenceS.is(value)) {
            return new LazyTypeReference(value.v, result.getLazy(value.v));
        }
        
        // TODO: message
        throw new Error("Deserialization error");
    }

    function deserializeFirst(value: WrapperKind<any>) {
        if (aliasS.is(value)) {
            result.tryAdd(
                value.v.id, 
                () => new AliasedType(value.v.id, value.v.n, deserializeSingle(value.v.a)));

            return;
        }

        // TODO: message
        throw new Error("Deserialization error 1");
    }

    Object.keys(values)
        .forEach(x => deserializeFirst(values[x]));

    return result;
}

export {
    deserialize,
    serialize,
    WrapperKind
}