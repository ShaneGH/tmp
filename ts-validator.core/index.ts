import { CompilerArgs } from './src/compilerArgs';
import { LazyDictionary } from './src/lazyDictionary';
import { TypedLookup } from './src/typedLookup';
import { deserialize, serialize, WrapperKind } from './src/serializer';
import {
    AliasedType,
    ArrayType,
    LazyTypeReference,
    MultiType,
    MultiTypeCombinator,
    Properties,
    Property,
    PropertyKeyword,
    PropertyType,
    Type,
} from './src/types';

export {
    CompilerArgs
}

export {
    LazyDictionary,
    TypedLookup
}

export {
    AliasedType,
    ArrayType,
    MultiType,
    MultiTypeCombinator,
    LazyTypeReference,
    Properties,
    Property,
    PropertyKeyword,
    PropertyType,
    Type
}

export {
    deserialize,
    serialize,
    WrapperKind
}