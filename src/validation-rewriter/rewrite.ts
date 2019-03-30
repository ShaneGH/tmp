import * as ts from "typescript";
import { tsquery } from '@phenomnomnominal/tsquery';
import * as _ from 'lodash';
import {isAncestor} from "../utils/astUtils";
import {compareArrays} from "../utils/arrayUtils";
import { resolveType, Type } from "./resolver";

const moduleName = "ts-validator";
const functionName = "validator";

function pad(text: string, pad: number) {
    var p = "";
    for (var i = 0; i < pad; i++) p += "  ";

    return text.split("\n").map(x => pad + "-" + p + x).join("\n");
}

function print(node: ts.Node, recurse = true, level = 0) {
    console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
    if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
}

type RewriteOutput = {
    file: ts.SourceFile,
    typeKeys: TypeKeys
}

class ImportGroupNode {
    children: ImportGroupNode[] = [];

    constructor (public groupNode: ts.Node, public parent: ImportGroupNode | null, public imports: ts.ImportDeclaration[]) {
    }

    getAllImports(): object[] {
        const parentImports = (this.parent && this.parent.getAllImports()) || [];

        return parentImports.concat(this.imports);
    }

    getAllImportsForNode(node: ts.Node): object[] {
        const group = this.getImportGroup(node);
        
        return group
            ? group.getAllImports()
            : [];
    }

    getImportGroup(node: ts.Node): ImportGroupNode | null {
        if (this.groupNode.pos > node.pos || this.groupNode.end < node.end) {
            return null;
        }

        return _(this.children)
            .map(x => x.getImportGroup(node))
            .filter(x => !!x)
            .first() || this;
    }
}

function buildImportGroups(file: ts.SourceFile): ImportGroupNode {
    type ImportGroups = { 
        orderedKeys: number[], 
        values: { [key: number]: { node: ts.Node, imports: ts.ImportDeclaration[] } }
    };

    type ImportGroupNodeRoot = { 
        reverseOrderedKeys: string[], 
        values: { [key: string]: ImportGroupNode }
    };

    const importGroups = tsquery<ts.ImportDeclaration>(file, "ImportDeclaration")
        // make sure that parents come before children
        // sort by position start asc
        .sort((x, y) => x.pos < y.pos
            ? -1
            : x.pos > y.pos
                ? 1
                // then by position end desc
                : x.end < y.pos
                    ? 1
                    : x.end > y.pos
                        ? -1
                        : 0)
        // combine all imports with the same parent node
        .reduce((s, x) => {
            if (s.values[x.parent.pos]) {
                s.values[x.parent.pos].imports.push(x);
            } else {
                s.values[x.parent.pos] = { node: x.parent, imports: [x] };
                s.orderedKeys.push(x.parent.pos);
            }

            return s;
        }, {orderedKeys: [], values: {}} as ImportGroups);

    const nodes: ImportGroupNodeRoot = { reverseOrderedKeys: [], values: {} };
    function findParent(node: ts.Node) {
        return _(nodes.reverseOrderedKeys)
            .filter(x => isAncestor(node, nodes.values[x].groupNode))
            .map(x => nodes.values[x])
            .first() || null;
    }

    for (var key in importGroups.orderedKeys) {
        const group = importGroups.values[key];
        const parentNode = findParent(group.node);

        nodes.reverseOrderedKeys.splice(0, 0, key);
        nodes.values[key] = new ImportGroupNode(group.node, parentNode, group.imports);
        if (parentNode) parentNode.children.push(nodes.values[key]);
    }

    const roots = nodes.reverseOrderedKeys
        .map(k => nodes.values[k])
        .filter(v => !v.parent);

    if (!roots.length) return new ImportGroupNode(file, null, []);
    if (roots.length == 1) return roots[0];

    const root = new ImportGroupNode(file, null, []);
    root.children.push.apply(root.children, roots);
    return root;
}

function flatten(importGroups: ImportGroupNode): ImportGroupNode[] {
    let result = [importGroups];
    for (var i = 0; i < importGroups.children.length; i++) {
        result = result.concat(flatten(importGroups.children[i]));
    }

    return result;
}

function getNamespaceImport(importNode: ts.ImportDeclaration) {

    const asNamespaceImport = tsquery<ts.NamespaceImport>(importNode, "NamespaceImport");
    if (asNamespaceImport.length > 1) {
        throw new Error(`Cannot parse import: ${importNode.getText()}`);
    }

    if (!asNamespaceImport.length) {
        return null;
    }

    const token = tsquery<ts.Identifier>(asNamespaceImport[0], "Identifier");
    if (token.length !== 1) {
        throw new Error(`Cannot parse import: ${importNode.getText()}`);
    }

    return token[0].escapedText.toString();
}

function asNamedImports(importNode: ts.ImportDeclaration) {

    return tsquery<ts.ImportSpecifier>(importNode, "ImportSpecifier")
        .filter(i => (!i.propertyName && i.name.escapedText.toString() === functionName) || (i.propertyName && i.propertyName.escapedText.toString() === functionName))
        .map(s => s.name.escapedText.toString());
}

const moduleStrings: {[key: string]: boolean} = {};
moduleStrings[`'${moduleName}'`] = true;
moduleStrings[`"${moduleName}"`] = true;
moduleStrings["`" + moduleName + "`"] = true;

function getReferenceToValidateFunction(importNode: ts.ImportDeclaration) {
    const importModule = tsquery(importNode, "StringLiteral");
    if (importModule.length !== 1) {
        throw new Error(`Cannot parse import: ${importNode.getText()}`);
    }

    if (!moduleStrings[importModule[0].getText()]) {
        return [[]];
    }

    const asNamespaceImport = getNamespaceImport(importNode);
    if (asNamespaceImport) {
        return [[asNamespaceImport, functionName]];
    }

    return asNamedImports(importNode)
        .map(x => [x]);
}

function getValidateFunctionNodes(importGroups: ImportGroupNode) {
    const result = flatten(importGroups)
        .map(x => ({
            group: x,
            imports: _.flatMap(x.imports, getReferenceToValidateFunction)
        }))
        .filter(x => !!x.imports.length)
        .map(x => tsquery<ts.CallExpression>(x.group.groupNode, "CallExpression")
            .filter(call => {

                let propertyParts: string[] = [];
                if (ts.isPropertyAccessExpression(call.expression)) {
                    propertyParts = call.expression.getText().split(".");
                } else if (ts.isIdentifier(call.expression)) {
                    propertyParts = [call.expression.escapedText.toString()];
                } else {
                    return false;
                }

                return !!_(x.imports)
                    .filter(xs => compareArrays(propertyParts, xs))
                    .first();
            }));

    return _.flatMap(result);
}

function getValidationType(node: ts.CallExpression) {
    if (!node.arguments || !node.arguments.length) {
        throw new Error(`${node.getText()} is not a call to ${functionName}(...).`);
    }

    return resolveType(node.arguments[0]);
}

type TypeKeys = {[key: string]: Type}
const transform = (validateCalls: ts.CallExpression[], keys: TypeKeys, relativePath: string) => <T extends ts.Node>(context: ts.TransformationContext) => (rootNode: T) => {

    // todo: ensure illegal character
    // todo: ensure it is a relative path
    relativePath += "?";
    let iKey = 0;

    function createKey(node: ts.CallExpression) {

        while (keys[relativePath + (++iKey)]) ;

        const key = relativePath + iKey;
        keys[key] = getValidationType(node);

        return ts.createLiteral(key);
    }
 
    function visit(node: ts.Node): ts.Node {
        node = ts.visitEachChild(node, visit, context);

        // ensure the node is correct
        if (!ts.isCallExpression(node) || validateCalls.indexOf(node) === -1) {
            return node;
        }

        if (node.arguments.length === 0 || node.arguments.length > 2) {
            throw new Error(`Cannot parse expression ${node.getText()}`);
        }

        if (node.arguments.length === 2) {
            const secondArg = node.arguments[1];
            if (!ts.isStringLiteral(secondArg)) {
                throw new Error(`Cannot parse expression ${node.getText()}`);
            }

            if (secondArg.text.startsWith(relativePath) && !keys[secondArg.text]) {
                keys[secondArg.text] = getValidationType(node);
                return node;
            }
        }

        // add second arg to method call 
        return ts.createCall(
            node.expression, 
            node.typeArguments, 
            [node.arguments[0], createKey(node)]);
    }

    return ts.visitNode(rootNode, visit)
}

function rewrite(file: ts.SourceFile): RewriteOutput {
    const importGroups = buildImportGroups(file);
    const functionCalls = getValidateFunctionNodes(importGroups);

    const keys: TypeKeys = {};
    const result: ts.TransformationResult<ts.SourceFile> = ts.transform<ts.SourceFile>(file, [transform(functionCalls, keys, file.fileName)]);
    if (result.transformed.length !== 1) {
        throw new Error(`Unknown transform result count. Expected 1, got ${result.transformed.length}`);
    }

    result.dispose();

    return {
        file: result.transformed[0],
        typeKeys: keys
    };
}

export {
    rewrite,
    RewriteOutput
}