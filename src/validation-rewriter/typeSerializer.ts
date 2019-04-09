import { Type, TypeWrapper, PropertyKeyword, PropertyType, PropertiesWrapper, ExtendsTypes, BinaryTypeCombinator, BinaryType } from './types';
import { LazyDictionary } from '../utils/lazyDictionary';

class TypeDictionary extends LazyDictionary<string, Type> {
    
    protected buildKey(key: string) {
        return key;
    }
}

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

type SerializablePropertyKeyword = {keyword: string}
type SerializablePropertyType = 
    WrapperKind<SerializablePropertyKeyword>
    | WrapperKind<SerializableProperty[]>   // PropertyWrapper
    | WrapperKind<string>   // TypeWrapper

type SerializableProperty = {
    name: string,
    type: SerializablePropertyType
};

type SerializableBinaryType = {
    left: SerializableExtendsTypes,
    right: SerializableExtendsTypes,
    combinator: BinaryTypeCombinator
};

const serializableTypeIdUtils = buildWrapperType<string>();
const serializablePropertyKeywordUtils = buildWrapperType<SerializablePropertyKeyword>();
const serializablePropertyWrapperUtils = buildWrapperType<SerializableProperty[]>();
const serializableBinaryTypeWrapperUtils = buildWrapperType<SerializableBinaryType>();

type SerializableExtendsTypes = WrapperKind<string> | WrapperKind<SerializablePropertyKeyword> | WrapperKind<SerializableBinaryType>

type SerializableType = {
    name: string,
    id: string,
    properties: SerializableProperty[]
    extends: SerializableExtendsTypes | null
};

function serializePropertyType(results: Dict<SerializableType>, p: PropertyType): SerializablePropertyType {
    if (p instanceof PropertyKeyword) {
        return serializablePropertyKeywordUtils.build(p);
    }

    if (p instanceof TypeWrapper) {
        const t = p.getType();
        serializeType(results, t);
        return serializableTypeIdUtils.build(t.id);
    }

    var properties = p.properties.map(x => ({
        name: x.name,
        type: serializePropertyType(results, x.type)
    }));

    return serializablePropertyWrapperUtils.build(properties);
}

function deserializePropertyType(results: TypeDictionary, p: SerializablePropertyType): PropertyType {
    if (serializablePropertyKeywordUtils.is(p)) {
        return PropertyKeyword.value(p.value.keyword);
    }

    if (serializableTypeIdUtils.is(p)) {
        return new TypeWrapper(results.getLazy(p.value));
    }
    
    return new PropertiesWrapper(p.value.map(x => ({
        name: x.name,
        type: deserializePropertyType(results, x.type)
    })));
}

function serializeExtends(results: Dict<SerializableType>, current: ExtendsTypes): SerializableExtendsTypes {
    if (current instanceof TypeWrapper) {
        serializeTypeAndAddToResults(results, current.getType());
        return serializableTypeIdUtils.build(current.getType().id);
    }
    
    if (current instanceof PropertyKeyword) {
        return serializablePropertyKeywordUtils.build({ keyword: current.keyword});
    }

    return serializableBinaryTypeWrapperUtils.build({
        left: serializeExtends(results, current.left),
        right: serializeExtends(results, current.right),
        combinator: current.combinator
    });
}

function deserializeExtends(results: TypeDictionary, current: SerializableExtendsTypes): ExtendsTypes {
    if (serializableTypeIdUtils.is(current)) {
        return new TypeWrapper(results.getLazy(current.value))
    }
    
    if (serializablePropertyKeywordUtils.is(current)) {
        return PropertyKeyword.value(current.value.keyword);
    }

    return new BinaryType(
        deserializeExtends(results, current.value.left),
        deserializeExtends(results, current.value.right),
        current.value.combinator);
}

type Dict<T> = {[key: string]: T};

function serializeTypeAndAddToResults (results: Dict<SerializableType>, current: Type): void {

    if (results[current.id]) return;

    results[current.id] = {
        name: current.name,
        id: current.id,
        extends: (current.extends && serializeExtends(results, current.extends)) || null,
        properties: []
    };

    for (var i = 0; i < current.properties.length; i++) {
        results[current.id].properties.push({
            name: current.properties[i].name,
            type: serializePropertyType(results, current.properties[i].type)
        });
    }
}

function deserializeTypeAndAddToResults (results: TypeDictionary, current: SerializableType): void {

    results.tryAdd(current.id, key => ({
        id: key,
        name: current.name,
        extends: (current.extends && deserializeExtends(results, current.extends)) || null,
        properties: current.properties.map(x => ({
            name: x.name,
            type: deserializePropertyType(results, x.type)
        }))
    }));
}

function serializeType (results: Dict<SerializableType>, current: Type) {
    serializeTypeAndAddToResults (results, current);
    return results;
}

function serialize(t: Type[]) {
    return t.reduce(serializeType, {} as Dict<SerializableType>);
}

function deserialize(input: Dict<SerializableType>): TypeDictionary {
    const output = new TypeDictionary();
    Object
        .keys(input)
        .forEach(x => deserializeTypeAndAddToResults(output, input[x]));

    return output;
}

export {
    deserialize,
    SerializableType,
    serialize
}