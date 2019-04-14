import { PropertyKeyword, Property, Properties, LazyTypeReference, BinaryType, BinaryTypeCombinator, AliasedType } from "./types";
import { LazyDictionary } from "./lazyDictionary";

let kindBuilder = 0;
type WrapperKind<T> = {
    __kind: number
    value: T
}

function buildWrapperType<T>() {

    const kind = ++kindBuilder;
    return {
        build: function (value: T): WrapperKind<T> {
            return {
                __kind: kind,
                value: value
            };
        },

        is: function (value: WrapperKind<any>): value is WrapperKind<T> {
            return value && value.__kind === kind;
        }
    }
};

const aliasS = buildWrapperType<AliasTypeS>();
type AliasTypeS = {
    id: string,
    name: string,
    aliased: WrapperKind<any>
}

const propertyS = buildWrapperType<PropertyS>();
type PropertyS = {
    name: string,
    type: WrapperKind<any>
}

const propertiesS = buildWrapperType<PropertiesS>();
type PropertiesS = {
    properties: PropertyS[]
}

const propertyKeywordS = buildWrapperType<string>();

const binaryTypeS = buildWrapperType<BinaryTypeS>();
type BinaryTypeS = {
    left: WrapperKind<any>,
    right: WrapperKind<any>,
    combinator: BinaryTypeCombinator
}

const lazyTypeReferenceS = buildWrapperType<string>();

function serialize(value: AliasedType[]) {

    const result = new LazyDictionary<WrapperKind<any>>();
    function serializeSingle(value: any): WrapperKind<any> {

        function serProperty(p: Property) {
            return {
                name: p.name,
                type: serializeSingle(p.type)
            };
        }
        
        if (value instanceof Property) {
            return propertyS.build(serProperty(value));
        }
        
        if (value instanceof Properties) {
            return propertiesS.build({
                properties: value.properties.map(serProperty)
            });
        }
        
        if (value instanceof PropertyKeyword) {
            return propertyKeywordS.build(value.keyword);
        }
        
        if (value instanceof BinaryType) {
            return binaryTypeS.build({
                combinator: value.combinator,
                left: serializeSingle(value.left),
                right: serializeSingle(value.right)
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
            name: value.name,
            aliased: serializeSingle(value.aliases)
        }))();    // evaluate to serialize any nested types
    }
        
    return result.toDictionary();
}

function deserialize(values: {[key: string]: WrapperKind<any>}) {

    const result = new LazyDictionary<AliasedType>();
    function deserializeSingle(value: WrapperKind<any>): any {

        function dserProperty(p: PropertyS) {
            return new Property(
                p.name,
                deserializeSingle(p.type));
        }
        
        if (propertyS.is(value)) {
            return dserProperty(value.value);
        }
        
        if (propertiesS.is(value)) {
            return new Properties(
                value.value.properties.map(dserProperty));
        }
        
        if (propertyKeywordS.is(value)) {
            const val = (PropertyKeyword as any)[value.value];
            if (!(val instanceof PropertyKeyword))
                throw new Error(`Invalid property keyword: ${value.value}`);
            
            return val;
        }
        
        if (binaryTypeS.is(value)) {
            return new BinaryType(
                deserializeSingle(value.value.left),
                deserializeSingle(value.value.right),
                value.value.combinator);
        }
        
        if (lazyTypeReferenceS.is(value)) {
            return new LazyTypeReference(value.value, result.getLazy(value.value));
        }
        
        // TODO: message
        throw new Error("Deserialization error");
    }

    function deserializeFirst(value: WrapperKind<any>) {
        if (aliasS.is(value)) {
            result.tryAdd(
                value.value.id, 
                () => new AliasedType(value.value.id, value.value.name, deserializeSingle(value.value.aliased)));

            return;
        }

        // TODO: message
        console.log(value)
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