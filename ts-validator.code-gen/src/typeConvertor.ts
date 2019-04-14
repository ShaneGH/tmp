import * as ts from 'typescript';
import { visitNodesInScope } from './utils/astUtils';
import { LazyDictionary, AliasedType, Property, Properties, BinaryType, BinaryTypeCombinator, PropertyType, LazyTypeReference, PropertyKeyword, Type } from 'ts-validator.core';

class ResolveTypeState {
    
    results: LazyDictionary<AliasedType>

    constructor(private _fileRelativePath: string, dictionary?: LazyDictionary<AliasedType>) {
        this.results = dictionary || new LazyDictionary<AliasedType>();
    }

    buildKey(key: ts.Node) {
        return `${key.pos}-${key.end}, ${this._fileRelativePath}`;
    }
}

function getPropertyForClassOrInterface(node: ts.TypeElement | ts.ClassElement, state: ResolveTypeState, file: ts.SourceFile): Property {
    if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node)) {
        throw new Error(`Member ${node.getText(file)} is not supported.`);
    }

    return getProperty(node, state, file);
}

function getProperty(node: ts.PropertySignature | ts.PropertyDeclaration, state: ResolveTypeState, file: ts.SourceFile): Property {
    if (!node.type) {
        throw new Error(`Member ${node.getText(file)} is not supported.`);
    }

    if (!ts.isIdentifier(node.name)) {
        throw new Error(`Member ${node.getText(file)} is not supported.`);
    }

    if (propertyKeywords[node.type.kind]) {
        const k = node.type.kind;
        return new Property(
            node.name.escapedText.toString(),
            propertyKeywords[k]);
    }

    if (ts.isTypeLiteralNode(node.type)) {
        return new Property(
            node.name.escapedText.toString(),
            new Properties(getProperties(node.type, state, file)));
    }

    if (ts.isTypeReferenceNode(node.type)) {
        if (!ts.isIdentifier(node.type.typeName)) {
            throw new Error(`Member ${node.getText(file)} is not supported.`);
        }

        const result = resolveType(node.type.typeName, state, file);
        if (!result) {
            throw new Error(`Cannot find type ${node.type.typeName.getText(file)} for property ${node.name.escapedText.toString()}.`);
        }

        return new Property(
            node.name.escapedText.toString(),
            result);
    }
    
    throw new Error(`Member ${node.getText(file)} is not supported.`);
}

function getProperties(node: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeLiteralNode, state: ResolveTypeState, file: ts.SourceFile): Property[] {

    if (ts.isInterfaceDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, state, file));
    } else if (ts.isClassDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, state, file));
    }

    return node.members.map(x => getPropertyForClassOrInterface(x, state, file));
}

function resolveTypeWithNullError(type: ts.TypeNode | ts.Identifier, state: ResolveTypeState, file: ts.SourceFile): PropertyType {
    const t = resolveType(type, state, file);
    if (!t) {
        throw new Error(`Cannot resolve type for ${type.getText(file)}`);
    }

    return t;
}

function buildExtends (extendsNames: ts.Identifier[], state: ResolveTypeState, file: ts.SourceFile): PropertyType {
    if (!extendsNames.length) throw new Error("You must extend at least one type");

    const first = resolveTypeWithNullError(extendsNames[0], state, file);

    return extendsNames
        .slice(1)
        .reduce((s, x) => new BinaryType(
            s,
            resolveTypeWithNullError(x, state, file),
            BinaryTypeCombinator.Intersection), first);
}

function buildClasssOrInterfaceType(name: string, node: ts.InterfaceDeclaration | ts.ClassDeclaration, state: ResolveTypeState, file: ts.SourceFile): LazyTypeReference {
        
    const id = state.buildKey(node);
    const result = state.results.tryAdd(id, function (): AliasedType {

        const extendsInterfaces: ts.Identifier[] = [];
        if (node.heritageClauses) {
            for (var i = 0; i < (node.heritageClauses || []).length; i++) {
                if (node.heritageClauses[i].token !== ts.SyntaxKind.ExtendsKeyword) {
                    continue;
                }

                for (var j = 0; j < node.heritageClauses[i].types.length; j++) {
                    const type = node.heritageClauses[i].types[j];
                    if (!ts.isIdentifier(type.expression)) {
                        throw new Error(`Unsupported extends clause ${type.expression.getText(file)}`);
                    }

                    if (type.typeArguments && type.typeArguments.length) {
                        throw new Error(`Generics are not supported yet ${type.expression.getText(file)}`);
                    }
                    
                    extendsInterfaces.push(type.expression);
                }
            }
        }

        const properties = getProperties(node, state, file);
        if (properties.length && extendsInterfaces.length) {
            return new AliasedType(id, name, 
                new BinaryType(
                    new Properties(properties),
                    buildExtends(extendsInterfaces, state, file),
                    BinaryTypeCombinator.Intersection));

        } else if (extendsInterfaces.length) {
            return new AliasedType(id, name, buildExtends(extendsInterfaces, state, file));
        } else {
            return new AliasedType(id, name, new Properties(properties));
        }
    });

    return new LazyTypeReference(result.key, result.value);
}
 
function resolveTypeOrThrow(type: ts.TypeNode | ts.Identifier, state: ResolveTypeState, file: ts.SourceFile) {
    const result = resolveType(type, state, file);
    if (!result) {
        throw new Error(`Could not resolve type: ${type.getText(file)}`);
    }
    
    return result;
}

function buildBinaryType(node: ts.UnionOrIntersectionTypeNode, state: ResolveTypeState, file: ts.SourceFile): PropertyType | null {
    if (!node.types.length) {
        return null;
    }

    const combinator = node.kind === ts.SyntaxKind.UnionType
        ? BinaryTypeCombinator.Union
        : BinaryTypeCombinator.Intersection;

    const types = node.types.map(x => resolveTypeOrThrow(x, state, file));

    return types
        .slice(1)
        .reduce((s, x) => 
            new BinaryType(s, x, combinator), 
            types[0]);
}
 
function buildBinaryTypeOrThrow(node: ts.UnionOrIntersectionTypeNode, state: ResolveTypeState, file: ts.SourceFile): PropertyType {
    const result = buildBinaryType(node, state, file);
    if (!result) {
        throw new Error(`Could not resolve type: ${node.getText(file)}`);
    }
    
    return result;
}

function buildTypeAliasType(name: string, node: ts.TypeAliasDeclaration, state: ResolveTypeState, file: ts.SourceFile) {

    const id = state.buildKey(node);
    const result = state.results.tryAdd(id, function () {

        if (ts.isTypeLiteralNode(node.type)) {
            return new AliasedType(
                id,
                name,
                new Properties(getProperties(node.type, state, file)));
        } else if (ts.isTypeReferenceNode(node.type)) {
            return new AliasedType(
                id,
                name,
                resolveTypeOrThrow(node.type, state, file));
        } else if (propertyKeywords[node.type.kind]) {
            return new AliasedType(id, name, propertyKeywords[node.type.kind]);
        } else if (ts.isUnionTypeNode(node.type) || ts.isIntersectionTypeNode(node.type)) {
            const result = buildBinaryType(node.type, state, file);
            if (!result) {
                return new AliasedType(id, name, new Properties([]));
            }

            return new AliasedType(id, name, result);
        } else {

            //throw new Error(`DEBUG 1: ${ts.SyntaxKind[node.type.kind]} ${node.getText(file)}`);
            throw new Error(`Unsupported type: ${node.getText(file)}`);
        }
    });

    return new LazyTypeReference(result.key, result.value);
}

const propertyKeywords: {[key: number]: PropertyKeyword} = {};
propertyKeywords[ts.SyntaxKind.StringKeyword] = PropertyKeyword.string;
propertyKeywords[ts.SyntaxKind.NumberKeyword] = PropertyKeyword.number;
propertyKeywords[ts.SyntaxKind.BooleanKeyword] = PropertyKeyword.boolean;
propertyKeywords[ts.SyntaxKind.NullKeyword] = PropertyKeyword.null;
propertyKeywords[ts.SyntaxKind.UndefinedKeyword] = PropertyKeyword.undefined;
propertyKeywords[ts.SyntaxKind.AnyKeyword] = PropertyKeyword.any;
propertyKeywords[ts.SyntaxKind.NeverKeyword] = PropertyKeyword.never;
propertyKeywords[ts.SyntaxKind.UnknownKeyword] = PropertyKeyword.unknown;
propertyKeywords[ts.SyntaxKind.VoidKeyword] = PropertyKeyword.void;

function resolveType(type: ts.TypeNode | ts.Identifier, state: ResolveTypeState, file: ts.SourceFile) {
    if (propertyKeywords[type.kind]) {
        return propertyKeywords[type.kind];
    }

    if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
        return buildBinaryTypeOrThrow(type, state, file);
    }

    if (ts.isTypeLiteralNode(type)) {
        return new Properties(getProperties(type, state, file));
    } 
    
    let name: ts.EntityName;
    if (ts.isIdentifier(type)) {
        name = type;
    } else if  (ts.isTypeReferenceNode(type)) {
        name = type.typeName;
    } else {
        // throw new Error(`DEBUG 2: ${ts.SyntaxKind[type.kind]} ${type.getText(file)}`);
        throw new Error(`Unsupported type: ${type.getText(file)}.`);
    }
    
    const typeName = ts.isIdentifier(name)
        ? [name.escapedText.toString()]
        : name.getText(file).split(".");

    if (typeName.length == 1) {
        return visitNodesInScope(type, x => {
            if (ts.isInterfaceDeclaration(x) || ts.isClassDeclaration(x)) {
                if (x.name && x.name.escapedText.toString() === typeName[0]) {
                    return buildClasssOrInterfaceType(typeName[0], x, state, file);
                }
            } else if (ts.isTypeAliasDeclaration(x) && x.name.escapedText.toString() === typeName[0]) {
                return buildTypeAliasType(typeName[0], x, state, file);
            }
        }) || null;
    } else {
        // https://github.com/ShaneGH/ts-validator/issues/16
        // throw new Error(`DEBUG 3: ${ts.SyntaxKind[type.kind]} ${type.getText(file)}`);
        throw new Error(`Unsupported type: ${type.getText(file)}.`);
    }
}

function publicResolveType(type: ts.TypeNode, file: ts.SourceFile, fileRelativePath: string, state?: LazyDictionary<AliasedType>): Type | null {
    const result = resolveType(type, new ResolveTypeState(fileRelativePath, state), file);
    if (!result) return null;

    return result instanceof LazyTypeReference ? result.getType() : result;
}

export {
    publicResolveType as convertType
}