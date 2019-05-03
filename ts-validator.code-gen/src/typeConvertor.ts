import * as ts from 'typescript';
import { visitNodesInScope } from './utils/astUtils';
import { LazyDictionary, AliasedType, Property, Properties, MultiType, MultiTypeCombinator, PropertyType, LazyTypeReference, PropertyKeyword, Type, ArrayType } from 'ts-validator.core';
import * as crypto from "crypto";

function sha1(input: string) {
    const shasum = crypto.createHash('sha1');
    shasum.update(input);
    return shasum.digest('base64');
}

class ResolveTypeState {
    
    results: LazyDictionary<AliasedType>

    constructor(private _fileRelativePath: string, public file: ts.SourceFile, dictionary?: LazyDictionary<AliasedType>) {
        this.results = dictionary || new LazyDictionary<AliasedType>();
    }

    buildKey(key: ts.Node, name: string) {
        return sha1(`${this._fileRelativePath}:${name},${key.pos}-${key.end}`).substr(0, 12);
    }
}

function getPropertyForClassOrInterface(node: ts.TypeElement | ts.ClassElement, state: ResolveTypeState): Property {
    if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node)) {
        throw new Error(`Member ${node.getText(state.file)} is not supported.`);
    }

    return getProperty(node, state);
}

function getProperty(node: ts.PropertySignature | ts.PropertyDeclaration, state: ResolveTypeState): Property {
    if (!node.type) {
        throw new Error(`Member ${node.getText(state.file)} is not supported.`);
    }

    const name = ts.isIdentifier(node.name)
        || ts.isStringLiteral(node.name)
        || ts.isNumericLiteral(node.name)
            ? node.name.text
            : null;

    if (!name) {
        throw new Error(`Member ${node.getText(state.file)} is not supported.`);
    }

    return new Property(
        name,
        resolveTypeOrThrow(node.type, state),
        !!node.questionToken);
}

function getProperties(node: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeLiteralNode, state: ResolveTypeState): Property[] {

    if (ts.isInterfaceDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, state));
    } else if (ts.isClassDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, state));
    }

    return node.members.map(x => getPropertyForClassOrInterface(x, state));
}

function resolveTypeWithNullError(type: ts.TypeNode | ts.Identifier, state: ResolveTypeState): PropertyType {
    const t = resolveType(type, state);
    if (!t) {
        throw new Error(`Cannot resolve type for ${type.getText(state.file)}`);
    }

    return t;
}

function buildExtends (extendsNames: ts.Identifier[], state: ResolveTypeState): MultiType {
    if (!extendsNames.length) throw new Error("You must extend at least one type");

    return new MultiType(
        extendsNames.map(x => resolveTypeWithNullError(x, state)),
        MultiTypeCombinator.Intersection);
}

function buildClasssOrInterfaceType(name: string, node: ts.InterfaceDeclaration | ts.ClassDeclaration, state: ResolveTypeState): LazyTypeReference {
        
    const id = state.buildKey(node, name);
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
                        throw new Error(`Unsupported extends clause ${type.expression.getText(state.file)}`);
                    }

                    if (type.typeArguments && type.typeArguments.length) {
                        throw new Error(`Generics are not supported yet ${type.expression.getText(state.file)}`);
                    }
                    
                    extendsInterfaces.push(type.expression);
                }
            }
        }

        const properties = getProperties(node, state);
        if (properties.length && extendsInterfaces.length) {
            return new AliasedType(id, name, 
                new MultiType([
                    new Properties(properties),
                    ...buildExtends(extendsInterfaces, state).types],
                    MultiTypeCombinator.Intersection));

        } else if (extendsInterfaces.length) {
            return new AliasedType(id, name, buildExtends(extendsInterfaces, state));
        } else {
            return new AliasedType(id, name, new Properties(properties));
        }
    });

    return new LazyTypeReference(id, result);
}
 
function resolveTypeOrThrow(type: ts.TypeNode | ts.Identifier, state: ResolveTypeState) {
    const result = resolveType(type, state);
    if (!result) {
        throw new Error(`Could not resolve type: ${type.getText(state.file)}`);
    }
    
    return result;
}

function buildMultiType(node: ts.UnionOrIntersectionTypeNode, state: ResolveTypeState): MultiType | null {
    if (!node.types.length) {
        return null;
    }

    return new MultiType(
        node.types.map(x => resolveTypeOrThrow(x, state)), 
        node.kind === ts.SyntaxKind.UnionType
            ? MultiTypeCombinator.Union
            : MultiTypeCombinator.Intersection);
}
 
function buildMultiTypeOrThrow(node: ts.UnionOrIntersectionTypeNode, state: ResolveTypeState) {
    const result = buildMultiType(node, state);
    if (!result) {
        throw new Error(`Could not resolve type: ${node.getText(state.file)}`);
    }
    
    return result;
}

function buildTypeAliasType(name: string, node: ts.TypeAliasDeclaration, state: ResolveTypeState) {

    const id = state.buildKey(node, name);
    const type = ts.isParenthesizedTypeNode(node.type)
        ? node.type.type
        : node.type;

    const result = state.results.tryAdd(id, function () {

        if (ts.isTypeLiteralNode(type)) {
            return new AliasedType(
                id,
                name,
                new Properties(getProperties(type, state)));
        } else if (ts.isTypeReferenceNode(type)) {
            return new AliasedType(
                id,
                name,
                resolveTypeOrThrow(type, state));
        } else if (propertyKeywords[type.kind]) {
            return new AliasedType(id, name, propertyKeywords[type.kind]);
        } else if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
            const result = buildMultiType(type, state);
            if (!result) {
                return new AliasedType(id, name, new Properties([]));
            }

            return new AliasedType(id, name, result);
        } else if (ts.isArrayTypeNode(type)) {
            return new AliasedType(id, name, 
                new ArrayType(resolveTypeWithNullError(type.elementType, state)));
        } else {

            throw new Error(`Unsupported type, ${ts.SyntaxKind[type.kind]}: ${node.getText(state.file)}`);
        }
    });

    return new LazyTypeReference(id, result);
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
propertyKeywords[ts.SyntaxKind.ObjectKeyword] = PropertyKeyword.object;

function resolveType(type: ts.TypeNode | ts.Identifier, state: ResolveTypeState): PropertyType | null {

    while (ts.isParenthesizedTypeNode(type)) {
        type = type.type;
    }

    if (propertyKeywords[type.kind]) {
        return propertyKeywords[type.kind];
    }

    if (ts.isUnionTypeNode(type) || ts.isIntersectionTypeNode(type)) {
        return buildMultiTypeOrThrow(type, state);
    }

    if (ts.isTypeLiteralNode(type)) {
        return new Properties(getProperties(type, state));
    }

    if (ts.isArrayTypeNode(type)) {
        return new ArrayType(
            resolveTypeOrThrow(type.elementType, state));
    }
    
    let name: ts.EntityName;
    if (ts.isIdentifier(type)) {
        name = type;
    } else if  (ts.isTypeReferenceNode(type)) {
        name = type.typeName;
    } else {
        throw new Error(`Unsupported type, ${ts.SyntaxKind[type.kind]}: ${type.getText(state.file)}.`);
    }
    
    const typeName = ts.isIdentifier(name)
        ? [name.text]
        : name.getText(state.file).split(".");

    if (typeName.length == 1) {
        return visitNodesInScope(type, x => {
            if (ts.isInterfaceDeclaration(x) || ts.isClassDeclaration(x)) {
                if (x.name && x.name.text === typeName[0]) {
                    return buildClasssOrInterfaceType(typeName[0], x, state);
                }
            } else if (ts.isTypeAliasDeclaration(x) && x.name.text === typeName[0]) {
                return buildTypeAliasType(typeName[0], x, state);
            }
        }) || null;
    } else {
        // https://github.com/ShaneGH/ts-validator/issues/16
        throw new Error(`Unsupported type, ${ts.SyntaxKind[type.kind]}: ${type.getText(state.file)}.`);
    }
}

function publicResolveType(type: ts.TypeNode, file: ts.SourceFile, fileRelativePath: string, state?: LazyDictionary<AliasedType>): Type | null {
    const result = resolveType(type, new ResolveTypeState(fileRelativePath, file, state));
    if (!result) return null;

    return result instanceof LazyTypeReference ? result.getType() : result;
}

export {
    publicResolveType as convertType
}