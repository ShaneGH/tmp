import * as ts from 'typescript';
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
    private constructor(public keyword: string, public validate: (x: any) => boolean) {}

    static string = new PropertyKeyword("string", x => typeof x === "string") 
    static number = new PropertyKeyword("number", x => typeof x === "number") 
    static boolean = new PropertyKeyword("boolean", x => typeof x === "boolean") 
    static any = new PropertyKeyword("any", x => true) 
    static null = new PropertyKeyword("null", x => x === null) 
    static undefined = new PropertyKeyword("undefined", x => x === undefined) 
    static unknown = new PropertyKeyword("unknown", x => { throw new Error('"unknown" is not a valid type'); }) 
    static never = new PropertyKeyword("never", x => false) 
    static void = new PropertyKeyword("void", x => { throw new Error('"void" is not a valid type'); })

    static value(key: string) {
        const result: PropertyKeyword = (PropertyKeyword as any)[key];
        if (result instanceof PropertyKeyword) {
            return result;
        }

        throw new Error(`${key} is not a valid property keyword.`);
    }
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

type ExtendsTypes = TypeWrapper | PropertyKeyword | BinaryType

enum BinaryTypeCombinator {
    Intersection = 1,
    Union
}

class BinaryType {
    constructor(public left: ExtendsTypes, public right: ExtendsTypes, public combinator: BinaryTypeCombinator) {
    }
}

type Type = {
    name: string,
    id: string,
    properties: Property[]
    extends: ExtendsTypes | null
};

function getPropertyForClassOrInterface(node: ts.TypeElement | ts.ClassElement, dictionary: TypeDictionary, file: ts.SourceFile): Property {
    if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node)) {
        throw new Error(`Member ${node.getText(file)} is not supported.`);
    }

    return getProperty(node, dictionary, file);
}

function getProperty(node: ts.PropertySignature | ts.PropertyDeclaration, dictionary: TypeDictionary, file: ts.SourceFile): Property {
    if (!node.type) {
        throw new Error(`Member ${node.getText(file)} is not supported.`);
    }

    if (!ts.isIdentifier(node.name)) {
        throw new Error(`Member ${node.getText(file)} is not supported.`);
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
            type: new PropertiesWrapper(node.type.members.map(x => getPropertyForClassOrInterface(x, dictionary, file)))
        };
    }

    if (ts.isTypeReferenceNode(node.type)) {
        if (!ts.isIdentifier(node.type.typeName)) {
            throw new Error(`Member ${node.getText(file)} is not supported.`);
        }

        const result = resolveType(node.type.typeName, dictionary, file);
        if (!result) {
            throw new Error(`Cannot find type ${node.type.typeName.getText(file)} for property ${node.name.escapedText.toString()}.`);
        }

        return {
            name: node.name.escapedText.toString(),
            type: new TypeWrapper(result)
        };
    }
    
    throw new Error(`Member ${node.getText(file)} is not supported.`);

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

function getProperties(node: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeLiteralNode, dictionary: TypeDictionary, file: ts.SourceFile): Property[] {

    if (ts.isInterfaceDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, dictionary, file));
    } else if (ts.isClassDeclaration(node)) {
        return node.members.map(x => getPropertyForClassOrInterface(x, dictionary, file));
    }

    return node.members.map(x => getPropertyForClassOrInterface(x, dictionary, file));
}

function resolveTypeWithNullError(type: ts.TypeNode | ts.Identifier, dictionary: TypeDictionary, file: ts.SourceFile): () => Type {
    const t = resolveType(type, dictionary, file);
    if (!t) {
        throw new Error(`Cannot resolve type for ${type.getText(file)}`);
    }

    return t;
}

function buildExtends (extendsNames: ts.Identifier[], dictionary: TypeDictionary, file: ts.SourceFile): ExtendsTypes | null {
    if (!extendsNames.length) return null;

    const first = new TypeWrapper(
        resolveTypeWithNullError(extendsNames[0], dictionary, file));

    return extendsNames
        .slice(1)
        .reduce((s, x) => new BinaryType(
            s,
            new TypeWrapper(
                resolveTypeWithNullError(x, dictionary, file)),
            BinaryTypeCombinator.Intersection), first as ExtendsTypes);
}

function buildClasssOrInterfaceType(name: string, node: ts.InterfaceDeclaration | ts.ClassDeclaration, dictionary: TypeDictionary, file: ts.SourceFile): () => Type {
        
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
                        throw new Error(`Unsupported extends clause ${type.expression.getText(file)}`);
                    }

                    if (type.typeArguments && type.typeArguments.length) {
                        throw new Error(`Generics are not supported yet ${type.expression.getText(file)}`);
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
            properties: getProperties(node, dictionary, file),
            extends: buildExtends(extendesInterfaces, dictionary, file)
        };
    });
}

function buildTypeAliasType(name: string, node: ts.TypeAliasDeclaration, dictionary: TypeDictionary, file: ts.SourceFile): (() => Type) {
 
    function resolveTypeOrThrow(type: ts.TypeNode | ts.Identifier) {
        const result = resolveType(type, dictionary, file);
        if (!result) {
            throw new Error(`Could not resolve type: ${node.getText(file)}`);
        }
        
        return result;
    }

    return dictionary.tryAdd(node, function (id) {

        if (ts.isTypeLiteralNode(node.type)) {
            return {
                id,
                name,
                properties: getProperties(node.type, dictionary, file),
                extends: null
            };
        } else if (ts.isTypeReferenceNode(node.type)) {
            return {
                id,
                name,
                properties: [],
                extends: new TypeWrapper(resolveTypeOrThrow(node.type))
            };
        } else if (propertyKeywords[node.type.kind]) {
            return {
                id,
                name,
                properties: [],
                extends: propertyKeywords[node.type.kind]
            };
        } else if (ts.isUnionTypeNode(node.type) || ts.isIntersectionTypeNode(node.type)) {
            if (!node.type.types.length) {
                return {
                    id,
                    name,
                    properties: [],
                    extends: null
                };
            }

            const combinator = node.type.kind === ts.SyntaxKind.UnionType
                ? BinaryTypeCombinator.Union
                : BinaryTypeCombinator.Intersection;

            const extendsPart = node.type.types
                .slice(1)
                .reduce((s, x) => 
                    new BinaryType(
                        s, 
                        new TypeWrapper(resolveTypeOrThrow(x)), 
                        combinator), 
                    new TypeWrapper(resolveTypeOrThrow(node.type.types[0])) as ExtendsTypes);

            return {
                id,
                name,
                properties: [],
                extends: extendsPart
            };
        } else {

            //throw new Error(`DEBUG 1: ${ts.SyntaxKind[node.type.kind]} ${node.getText(file)}`);
            throw new Error(`Unsupported type: ${node.getText(file)}`);
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
    
    constructor(private _fileRelativePath: string) {
        super();
    }

    protected buildKey(key: ts.Node) {
        return `${key.pos}-${key.end}, ${this._fileRelativePath}`;
    }
}

function resolveType(type: ts.TypeNode | ts.Identifier, dictionary: TypeDictionary, file: ts.SourceFile): (() => Type) | null {
    if (propertyKeywords[type.kind]) {
        return () => ({
            id: propertyKeywords[type.kind].keyword,
            name: propertyKeywords[type.kind].keyword,
            properties: [],
            extends: propertyKeywords[type.kind]
        });
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
            if ((ts.isInterfaceDeclaration(x) || ts.isClassDeclaration(x)) && x.name && x.name.escapedText.toString() === typeName[0]) {
                return buildClasssOrInterfaceType(typeName[0], x, dictionary, file);
            } 
            
            if (ts.isTypeAliasDeclaration(x) && x.name.escapedText.toString() === typeName[0]) {
                return buildTypeAliasType(typeName[0], x, dictionary, file);
            }
        }) || null;
    } else {
        // https://github.com/ShaneGH/ts-validator/issues/16
        // throw new Error(`DEBUG 3: ${ts.SyntaxKind[type.kind]} ${type.getText(file)}`);
        throw new Error(`Unsupported type: ${type.getText(file)}.`);
    }
}

function publicResolveType(type: ts.TypeNode | ts.Identifier, file: ts.SourceFile, fileRelativePath: string): Type | null {
    const result = resolveType(type, new TypeDictionary(fileRelativePath), file);
    return result ? result() : null;
}

export {
    BinaryTypeCombinator,
    BinaryType,
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