import * as ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { visitNodesInScope } from '../utils/astUtils';
import { LazyDictionary } from '../utils/lazyDictionary';

function pad(text: string, pad: number) {
    var p = "";
    for (var i = 0; i < pad; i++) p += "  ";

    return text.split("\n").map(x => pad + "-" + p + x).join("\n");
}

function print(node: ts.Node, recurse = true, level = 0) {
    console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
    if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
}

class ExternalReference {
    constructor(public reference: string) { }
}

class PropertiesWrapper {
    constructor(public properties: Property[]) { }
}

class TypeWrapper {
    constructor(private type: () => Type) { }

    getType() {
        return this.type instanceof Function
            ? this.type()
            : this.type;
    }
}

class PropertyKeyword {
    private constructor(public keyword: string) {}

    static string = new PropertyKeyword("string") 
    static number = new PropertyKeyword("number") 
    static boolean = new PropertyKeyword("boolean") 
    static any = new PropertyKeyword("any") 
    static null = new PropertyKeyword("null") 
    static undefined = new PropertyKeyword("undefined") 
    static unknown = new PropertyKeyword("unknown") 
    static never = new PropertyKeyword("never") 
    static void = new PropertyKeyword("void")
}

type PropertyType = 
    PropertyKeyword
    // | "Date" 
    // | "Regexp" 
    // | Function  // constructor
    | PropertiesWrapper
    | TypeWrapper
//    | ExternalReference;

type Property = {
    name: string,
    type: PropertyType
};

type ExtendsTypes = TypeWrapper | PropertyKeyword

type Type = {
    name: string,
    id: string,
    properties: Property[]
    extends: ExtendsTypes[]
};

function getPropertyForClassOrInterface(node: ts.TypeElement | ts.ClassElement, dictionary: TypeDictionary): Property {
    if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node)) {
        throw new Error(`Member ${node.getText()} is not supported.`);
    }

    return getProperty(node, dictionary);
}

function getProperty(node: ts.PropertySignature | ts.PropertyDeclaration, dictionary: TypeDictionary): Property {
    if (!node.type) {
        throw new Error(`Member ${node.getText()} is not supported.`);
    }

    if (!ts.isIdentifier(node.name)) {
        throw new Error(`Member ${node.getText()} is not supported.`);
    }

    if (propertyKeywords[node.type.kind]) {
        return {
            name: node.name.escapedText.toString(),
            type: propertyKeywords[node.type.kind]
        };
    }

    if (ts.isTypeLiteralNode(node.type)) {
        return {
            name: node.name.escapedText.toString(),
            type: new PropertiesWrapper(node.type.members.map(x => getPropertyForClassOrInterface(x, dictionary)))
        };
    }

    if (ts.isTypeReferenceNode(node.type)) {
        if (!ts.isIdentifier(node.type.typeName)) {
            throw new Error(`Member ${node.getText()} is not supported.`);
        }

        const result = resolveType(node.type.typeName, dictionary);
        if (!result) {
            throw new Error(`Cannot find type ${node.type.typeName.getText()} for property ${node.name.escapedText.toString()}.`);
        }

        return {
            name: node.name.escapedText.toString(),
            type: new TypeWrapper(result)
        };
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

function getProperties(node: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeLiteralNode, dictionary: TypeDictionary): Property[] {

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
        
    return dictionary.tryAdd(node, function (id) {

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

                    // https://github.com/ShaneGH/ts-validator/issues/16
                    extendesInterfaces.push(type.expression);
                }
            }
        }

        // https://github.com/ShaneGH/ts-validator/issues/13
        return {
            name,
            id,
            properties: getProperties(node, dictionary),
            extends: extendesInterfaces.map(x => new TypeWrapper(resolveTypeWithNullError(x, dictionary)))
        };
    });
}

function buildTypeAliasType(name: string, node: ts.TypeAliasDeclaration, dictionary: TypeDictionary): (() => Type) {
        
    return dictionary.tryAdd(node, function (id) {

        if (ts.isTypeLiteralNode(node.type)) {
            return {
                id,
                name,
                properties: getProperties(node.type, dictionary),
                extends: []
            };
        } else if (ts.isTypeReferenceNode(node.type)) {
            const result = resolveType(node.type, dictionary);
            if (!result) {
                throw new Error(`Could not resolve type: ${node.getText()}`);
            }

            return {
                id,
                name,
                properties: [],
                extends: [new TypeWrapper(result)]
            };
        } else if (propertyKeywords[node.type.kind]) {
            return {
                id,
                name,
                properties: [],
                extends: [propertyKeywords[node.type.kind]]
            };
        } else {

            throw new Error(`Unsupported type: ${node.getText()}`);
        }
    });
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

class TypeDictionary extends LazyDictionary<ts.Node, Type> {
    
    protected buildKey(key: ts.Node) {
        return `${key.pos}-${key.end}, ${key.getSourceFile().fileName}`;
    }
}

function resolveType(type: ts.TypeNode | ts.Identifier, dictionary: TypeDictionary): (() => Type) | null {
    if (propertyKeywords[type.kind]) {
        return () => ({
            id: propertyKeywords[type.kind].keyword,
            name: propertyKeywords[type.kind].keyword,
            properties: [],
            extends: [propertyKeywords[type.kind]]
        });
    }

    let name: ts.EntityName;
    if (ts.isIdentifier(type)) {
        name = type;
    } else if  (ts.isTypeReferenceNode(type)) {
        name = type.typeName;
    } else {
        // https://github.com/ShaneGH/ts-validator/issues/16
        throw new Error(`Unsupported type: ${type.getText()}.`);
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
        // https://github.com/ShaneGH/ts-validator/issues/16
        throw new Error(`Unsupported type: ${type.getText()}.`);
    }
}

function publicResolveType(type: ts.TypeNode | ts.Identifier): Type | null {
    const result = resolveType(type, new TypeDictionary());
    return result ? result() : null;
}

export {
    ExtendsTypes,
    ExternalReference,
    Property,
    PropertyKeyword,
    PropertyType,
    PropertiesWrapper,
    publicResolveType as resolveType,
    Type,
    TypeWrapper
}