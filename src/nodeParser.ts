import * as ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

function pad(text: string, pad: number) {
    var p = "";
    for (var i = 0; i < pad; i++) p += "  ";

    return text.split("\n").map(x => pad + "-" + p + x).join("\n");
}

function print(node: ts.Node, recurse = true, level = 0) {
    console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
    if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
}

function indexOf(parent: ts.Node, child: ts.Node) {
    var children = parent.getChildren();
    for (var i = 0; i < children.length; i++) {
        if (children[i] === child) return i;
    }

    return -1;
}

const isSupportedInPropertyList = (node: ts.Node) =>
    node.kind != ts.SyntaxKind.UnionType
        && node.kind != ts.SyntaxKind.FunctionType;

const isProperty = (node: ts.Node) => 
    node.kind == ts.SyntaxKind.PropertySignature
    || node.kind == ts.SyntaxKind.PropertyDeclaration;

type NamedTypeNode = { node: ts.Node, name: string };
    
function getTypes(node: ts.Node): NamedTypeNode[] {

    return tsquery(node, "InterfaceDeclaration, ClassDeclaration, TypeAliasDeclaration")
        .map(x => ({ node: x, name: getName(x) }));
}

class ExternalReference {
    constructor(public reference: string) { }
}

class PropertyWrapper {
    constructor(public property: Property) { }
}

type PropertyKeyword =
    "string" 
    | "number"
    | "boolean" 
    | "any" 
    | "null" 
    | "undefined" 

type PropertyType = 
    PropertyKeyword
    // | "Date" 
    // | "Regexp" 
    // | Function  // constructor
    | PropertyWrapper[]
//    | ExternalReference;

type Property = {
    name: string,
    type: PropertyType[]
};

type Type = {
    name: string,
    properties: Property[] | PropertyKeyword
};

function tryGetNameFromTypeKeyword(propType: ts.Node) : PropertyKeyword | null{
    switch (propType.kind) {
        case ts.SyntaxKind.StringKeyword:
            return "string";
        case ts.SyntaxKind.NumberKeyword:
            return "number";
        case ts.SyntaxKind.BooleanKeyword:
            return "boolean";
        case ts.SyntaxKind.AnyKeyword:
            return "any";
        case ts.SyntaxKind.NullKeyword:
            return "null";
        case ts.SyntaxKind.UndefinedKeyword:
            return "undefined";
        default:
            return null;
    }
}

function buildPropertyType(propType: ts.Node): PropertyType[] | null {
    var keyword = tryGetNameFromTypeKeyword(propType);
    if (keyword) return [keyword];

    if (propType.kind === ts.SyntaxKind.TypeLiteral) {
        return [getProperties(propType)];
    }

    if (propType.kind === ts.SyntaxKind.UnionType) {
        const children = propType.getChildren();
        if (children.length !== 1 || children[0].kind != ts.SyntaxKind.SyntaxList) {
            throw new Error("TODO: cannot understand union type 1");
        }

        let unionTypes: PropertyType[] = [];
        const unionParts = children[0].getChildren();
        for (var i = 0; i < unionParts.length; i++) {
            const t = buildPropertyType(unionParts[i]);
            if (!t) {
                print(children[0]);
                throw new Error("TODO: cannot understand union type 2");
            }

            unionTypes = unionTypes.concat(t);

            i++;
            if (i < unionParts.length && unionParts[i].kind !== ts.SyntaxKind.BarToken) {
                throw new Error("TODO: cannot understand union type 3");
            }
        }

        if (!unionTypes.length) {
            throw new Error("TODO: cannot understand union type 4");
        }

        return unionTypes;
    }

    return null;
}

function buildProperty(prop: ts.Node): Property {

    var parts = prop.getChildren();
    if (parts.length < 2 
        || parts[0].kind != ts.SyntaxKind.Identifier) {
        throw new Error(`Invalid property: ${prop.getFullText(prop.getSourceFile())} ${ts.SyntaxKind[prop.kind]}`);
    }

    for (var i = 1; i < parts.length; i++) {
        const t = buildPropertyType(parts[i]);

        if (t) {
            return {
                name: parts[0].getText(),
                type: t
            };
        }
    }
    
    throw new Error(`Invalid property: ${prop.getFullText()} ${ts.SyntaxKind[prop.kind]}`);
};

function getProperties(node: ts.Node): PropertyWrapper[] {
    
    if (!isSupportedInPropertyList(node)) {
        throw new Error(`Node ${ts.SyntaxKind[node.kind]} is not supported.`);
    }

    if (isProperty(node)) {
        return [new PropertyWrapper(buildProperty(node))];
    }

    return node.getChildren()
        .map(x => getProperties(x))
        .reduce((s, x) => s.concat(x), []);
}

function tryGetName(node: ts.Node): string[] {
    if (node.kind === ts.SyntaxKind.Identifier) {
        return [node.getFullText().trim()];
    }

    return node
        .getChildren()
        .map(tryGetName)
        .reduce((x, s) => x.concat(s), [])
        .filter(x => x);
}

function getName(node: ts.Node): string {
    const names = tryGetName(node);
    if (!names.length) throw new Error("TODO: can't find class name/interface name etc....");

    return names[0];
}

function getTypeAliasName (typeAliasDeclaration: ts.Node): string | null {

    if (typeAliasDeclaration.kind !== ts.SyntaxKind.TypeAliasDeclaration) return null;

    return typeAliasDeclaration
        .getChildren()
        .filter(x => x.kind === ts.SyntaxKind.TypeReference)
        .map(x => x.getFullText().trim())[0] || null;
}

function findType(name: string, types: NamedTypeNode[]): NamedTypeNode | null {
    return types
        .filter(t => t.name === name)[0] || null;
}

function findTypeKeyword(typeAliasDeclaration: ts.Node): PropertyKeyword | null {

    if (typeAliasDeclaration.kind !== ts.SyntaxKind.TypeAliasDeclaration) return null;
    
    return typeAliasDeclaration
        .getChildren()
        .map(tryGetNameFromTypeKeyword)
        .filter(x => x)[0] || null;
}

function depthFirstSearch(node: ts.Node, kind: ts.SyntaxKind) : ts.Node | null {
    if (node.kind === kind) return node;

    const children = node.getChildren();
    for (var i = 0; i < children.length; i++) {
        const result = depthFirstSearch(children[i], kind);
        if (result) return result;
    }

    return null;
}

function _sudoBreadthFirstSearch(nodes: ts.Node[], kind: ts.SyntaxKind) : ts.Node | null {
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].kind === kind) return nodes[i];
    }
    
    for (var i = 0; i < nodes.length; i++) {
        const result = _sudoBreadthFirstSearch(nodes[i].getChildren(), kind);
        if (result) return result;
    }

    return null;
}

function sudoBreadthFirstSearch(node: ts.Node, kind: ts.SyntaxKind) : ts.Node | null {
    if (node.kind === kind) return node;

    return _sudoBreadthFirstSearch(node.getChildren(), kind);
}

function getExtends(node: ts.Node): string | null {

    const extn = sudoBreadthFirstSearch(node, ts.SyntaxKind.ExtendsKeyword);
    if (!extn) return null;

    var identifier = depthFirstSearch(extn.parent.getChildAt(indexOf(extn.parent, extn) + 1), ts.SyntaxKind.Identifier);
    return identifier ? identifier.getFullText().trim() : null;
}

function buildType(type: NamedTypeNode, allTypes: NamedTypeNode[]): Type {
    const typeKeyword = findTypeKeyword(type.node);
    if (typeKeyword) {
        return {
            name: type.name,
            properties: typeKeyword
        };
    }

    var typeAlias = getTypeAliasName(type.node);
    if (typeAlias) {
        const t = findType(typeAlias, allTypes);
        if (!t) throw new Error("TODO: cannot find type with alias XXX");

        return {
            name: type.name,
            properties: getProperties(t.node).map(x => x.property)
        };
    }

    let extendsProps: PropertyWrapper[] = [];
    const extn = getExtends(type.node);
    if (extn) {
        const type = findType(extn, allTypes);
        if (!type) throw new Error("TODO: cannot find type with alias XXX");

        extendsProps = getProperties(type.node);
    }

    return {
        name: type.name,
        properties: extendsProps
            .concat(getProperties(type.node))
            .map(x => x.property)
    };
}

function parser (file: ts.SourceFile): Type[] {
    const types = getTypes(file);
    return types
        .map(x => buildType(x, types));
}

export {
    ExternalReference,
    parser,
    Property,
    PropertyKeyword,
    PropertyType,
    PropertyWrapper,
    Type
}