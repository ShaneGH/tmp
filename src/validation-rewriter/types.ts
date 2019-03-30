import * as ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { visitNodesInScope } from '../utils/astUtils';

function pad(text: string, pad: number) {
    var p = "";
    for (var i = 0; i < pad; i++) p += "  ";

    return text.split("\n").map(x => pad + "-" + p + x).join("\n");
}

function print(node: ts.Node, recurse = true, level = 0) {
    console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
    if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
}

function buildNodeKey(node: ts.Node) {
    return `${node.pos}-${node.end}, ${node.getSourceFile().fileName}`;
}

class ExternalReference {
    constructor(public reference: string) { }
}

class PropertyWrapper {
    constructor(public property: Property) { }
}

class TypeWrapper {
    constructor(private type: Type | (() => Type)) { }

    getType() {
        return this.type instanceof Function
            ? this.type()
            : this.type;
    }
}

type PropertyKeyword =
    "string" 
    | "number"
    | "boolean" 
    | "any" 
    | "null" 
    | "undefined" 
    | "unknown" 
    | "never" 
    | "void" 

type PropertyType = 
    PropertyKeyword
    // | "Date" 
    // | "Regexp" 
    // | Function  // constructor
    | PropertyWrapper[]
    | TypeWrapper
//    | ExternalReference;

type Property = {
    name: string,
    type: PropertyType
};

type Type = {
    name: string,
    // TODO: remove TypeWrapper from here and add to Extends
    properties: Property[] | PropertyKeyword | TypeWrapper
    extends: (() => Type)[]
};

function getPropertyForClassOrInterface(node: ts.TypeElement | ts.ClassElement, dictionary: TypeDictionary): PropertyWrapper {
    if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node)) {
        throw new Error(`Member ${node.getText()} is not supported.`);
    }

    return getProperty(node, dictionary);
}

function getProperty(node: ts.PropertySignature | ts.PropertyDeclaration, dictionary: TypeDictionary): PropertyWrapper {
    if (!node.type) {
        throw new Error(`Member ${node.getText()} is not supported.`);
    }

    if (!ts.isIdentifier(node.name)) {
        throw new Error(`Member ${node.getText()} is not supported.`);
    }

    if (propertyKeywords[node.type.kind]) {
        return new PropertyWrapper({
            name: node.name.escapedText.toString(),
            type: propertyKeywords[node.type.kind]
        });
    }

    if (ts.isTypeLiteralNode(node.type)) {
        return new PropertyWrapper({
            name: node.name.escapedText.toString(),
            type: node.type.members.map(x => getPropertyForClassOrInterface(x, dictionary))
        });
    }

    if (ts.isTypeReferenceNode(node.type)) {
        if (!ts.isIdentifier(node.type.typeName)) {
            throw new Error(`Member ${node.getText()} is not supported.`);
        }

        const result = resolveType(node.type.typeName, dictionary);
        if (!result) {
            throw new Error(`Cannot find type ${node.type.typeName.getText()} for property ${node.name.escapedText.toString()}.`);
        }

        return new PropertyWrapper({
            name: node.name.escapedText.toString(),
            type: new TypeWrapper(result)
        });
    }
    
    throw new Error(`Member ${node.getText()} is not supported.`);

        // const children = propType.getChildren();
        // if (children.length !== 1 || children[0].kind != ts.SyntaxKind.SyntaxList) {
        //     throw new Error("TODO: cannot understand union type 1");
        // }

        // let unionTypes: PropertyType[] = [];
        // const unionParts = children[0].getChildren();
        // for (var i = 0; i < unionParts.length; i++) {
        //     const t = buildPropertyType(unionParts[i]);
        //     if (!t) {
        //         print(children[0]);
        //         throw new Error("TODO: cannot understand union type 2");
        //     }

        //     unionTypes = unionTypes.concat(t);

        //     i++;
        //     if (i < unionParts.length && unionParts[i].kind !== ts.SyntaxKind.BarToken) {
        //         throw new Error("TODO: cannot understand union type 3");
        //     }
        // }

        // if (!unionTypes.length) {
        //     throw new Error("TODO: cannot understand union type 4");
        // }

        // return unionTypes;
}

function getProperties(node: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeLiteralNode, dictionary: TypeDictionary): PropertyWrapper[] {

    if (ts.isInterfaceDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, dictionary));
    } else if (ts.isClassDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, dictionary));
    }

    return node.members.map(x => getPropertyForClassOrInterface(x, dictionary));
}

function resolveTypeWithNullError(type: ts.TypeNode | ts.Identifier, dictionary: TypeDictionary): () => Type {
    const t = resolveType(type, dictionary);
    if (!t) {
        throw new Error(`Cannot resolve type for ${type.getText()}`);
    }

    return t;
}

function buildClasssOrInterfaceType(name: string, node: ts.InterfaceDeclaration | ts.ClassDeclaration, dictionary: TypeDictionary): () => Type {

    const existing = dictionary.tryGet(node);
    if (existing) return existing;
        
    return dictionary.tryAdd(node, function () {

        const extendesInterfaces: ts.Identifier[] = [];
        if (node.heritageClauses) {
            for (var i = 0; i < (node.heritageClauses || []).length; i++) {
                if (node.heritageClauses[i].token !== ts.SyntaxKind.ExtendsKeyword) {
                    continue;
                }

                for (var j = 0; j < node.heritageClauses[i].types.length; j++) {
                    const type = node.heritageClauses[i].types[j];
                    if (!ts.isIdentifier(type.expression)) {
                        throw new Error(`Unsupported extends clause ${type.expression.getText()}`);
                    }

                    if (type.typeArguments && type.typeArguments.length) {
                        throw new Error(`Generics are not supported yet ${type.expression.getText()}`);
                    }

                    // TODO: what does "T extends x.U" look like
                    extendesInterfaces.push(type.expression);
                }
            }
        }

        // TODO: if class declaration, try get constructor
        return {
            name: name,
            properties: getProperties(node, dictionary).map(x => x.property),
            extends: extendesInterfaces.map(x => resolveTypeWithNullError(x, dictionary))
        };
    });
}

function buildTypeAliasType(name: string, node: ts.TypeAliasDeclaration, dictionary: TypeDictionary): (() => Type) {
    
    const existing = dictionary.tryGet(node);
    if (existing) return existing;
        
    return dictionary.tryAdd(node, function () {

        if (ts.isTypeLiteralNode(node.type)) {
            return {
                name: name,
                properties: getProperties(node.type, dictionary).map(x => x.property),
                extends: []
            };
        } else if (ts.isTypeReferenceNode(node.type)) {
            const result = resolveType(node.type, dictionary);
            if (!result) {
                throw new Error(`Could not resolve type: ${node.getText()}`);
            }

            return {
                name: name,
                properties: new TypeWrapper(result),
                extends: []
            };
        } else if (propertyKeywords[node.type.kind]) {
            return {
                name: name,
                properties: propertyKeywords[node.type.kind],
                extends: []
            };
        } else {

            throw new Error(`Unsupported type: ${node.getText()}`);
        }
    });
}

const propertyKeywords: {[key: number]: PropertyKeyword} = {};
propertyKeywords[ts.SyntaxKind.StringKeyword] = "string";
propertyKeywords[ts.SyntaxKind.NumberKeyword] = "number";
propertyKeywords[ts.SyntaxKind.BooleanKeyword] = "boolean";
propertyKeywords[ts.SyntaxKind.NullKeyword] = "null";
propertyKeywords[ts.SyntaxKind.UndefinedKeyword] = "undefined";
propertyKeywords[ts.SyntaxKind.AnyKeyword] = "any";
propertyKeywords[ts.SyntaxKind.NeverKeyword] = "never";
propertyKeywords[ts.SyntaxKind.UnknownKeyword] = "unknown";
propertyKeywords[ts.SyntaxKind.VoidKeyword] = "void";

class TypeDictionary {
    private values: {[key: string]: () => Type} = {}

    tryAdd(typeDefinitionNode: ts.Node, value: () => Type) {
        const key = buildNodeKey(typeDefinitionNode);
        if (this.values[key]) {
            return this.values[key];
        }

        let val: Type | null = null;
        return this.values[key] = function () {
            return val || (val = value());
        };
    }

    tryGet(typeDefinitionNode: ts.Node) {
        const key = buildNodeKey(typeDefinitionNode);
        const result = this.values[key];
        if (!result) return null;

        return result;
    }
}

function resolveType(type: ts.TypeNode | ts.Identifier, dictionary: TypeDictionary): (() => Type) | null {
    if (propertyKeywords[type.kind]) {
        return () => ({
            name: propertyKeywords[type.kind],
            properties: propertyKeywords[type.kind],
            extends: []
        });
    }

    let name: ts.EntityName;
    if (ts.isIdentifier(type)) {
        name = type;
    } else if  (ts.isTypeReferenceNode(type)) {
        name = type.typeName;
    } else {
        throw new Error('TODO: type is indexedAccessType (var tt: yy["vv"] = 7');
    }
    
    const typeName = ts.isIdentifier(name)
        ? [name.escapedText.toString()]
        : name.getText().split(".");

    if (typeName.length == 1) {
        return visitNodesInScope(type, x => {
            if ((ts.isInterfaceDeclaration(x) || ts.isClassDeclaration(x)) && x.name && x.name.escapedText.toString() === typeName[0]) {
                return buildClasssOrInterfaceType(typeName[0], x, dictionary);
            } 
            
            if (ts.isTypeAliasDeclaration(x) && x.name.escapedText.toString() === typeName[0]) {
                return buildTypeAliasType(typeName[0], x, dictionary);
            }
        }) || null;
    } else {
        throw new Error("TODO: var t: x.y");
    }
}

function publicResolveType(type: ts.TypeNode | ts.Identifier): Type | null {
    const result = resolveType(type, new TypeDictionary());
    return result ? result() : null;
}

export {
    ExternalReference,
    Property,
    PropertyKeyword,
    PropertyType,
    PropertyWrapper,
    publicResolveType as resolveType,
    Type,
    TypeWrapper
}