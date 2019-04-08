import * as ts from 'typescript';
import { visitNodesInScope } from '../utils/astUtils';
import { resolveType as resolveTypeNode, Type, PropertyKeyword } from './types';


function pad(text: string, pad: number) {
    var p = "";
    for (var i = 0; i < pad; i++) p += "  ";

    return text.split("\n").map(x => pad + "-" + p + x).join("\n");
}

function print(node: ts.Node, recurse = true, level = 0) {
    console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
    if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
}

const propertyKeywords: {[key: number]: PropertyKeyword} = {};
propertyKeywords[ts.SyntaxKind.StringLiteral] = PropertyKeyword.string;
propertyKeywords[ts.SyntaxKind.NumericLiteral] = PropertyKeyword.number;
propertyKeywords[ts.SyntaxKind.TrueKeyword] = PropertyKeyword.boolean;
propertyKeywords[ts.SyntaxKind.FalseKeyword] = PropertyKeyword.boolean;
propertyKeywords[ts.SyntaxKind.NullKeyword] = PropertyKeyword.null;
propertyKeywords[ts.SyntaxKind.UndefinedKeyword] = PropertyKeyword.undefined;

// TODO: not sure how this function deals with the var
// keyword, and multiple usages of the same word
function findVariableDeclaration(variable: ts.Identifier, file: ts.SourceFile) {

    const variableName = variable.escapedText.toString();
    return visitNodesInScope(variable, x => {

        if (!ts.isVariableStatement(x)) return null;

        for (var j = 0; j < x.declarationList.declarations.length; j++) {
            const name = x.declarationList.declarations[j].name;
            if (ts.isIdentifier(name)) {
                if (name.escapedText.toString() === variableName) {
                    return x.declarationList.declarations[j];
                }

                continue;
            }
            
            // TODO: what code would cause this case?
            throw new Error(`Binding patterns are not supported: ${x.getText(file)}`);
        }
    });
}

function resolveTypeForExpression(expr: ts.Expression, file: ts.SourceFile, fileRelativePath: string): Type {
    if (propertyKeywords[expr.kind]) {
        return {
            id: propertyKeywords[expr.kind].keyword,
            name: propertyKeywords[expr.kind].keyword,
            properties: [],
            extends: [propertyKeywords[expr.kind]]
        };
    }

    if (ts.isIdentifier(expr)) {
        // undefined is handled a little differently
        if (expr.escapedText.toString() === "undefined") {
            return {
                name: propertyKeywords[ts.SyntaxKind.UndefinedKeyword].keyword,
                id: propertyKeywords[ts.SyntaxKind.UndefinedKeyword].keyword,
                properties: [],
                extends: [propertyKeywords[ts.SyntaxKind.UndefinedKeyword]]
            };
        }
        
        const varDec = findVariableDeclaration(expr, file);
        if (!varDec) {
            throw new Error(`Cannot find declaration of variable: ${expr.getFullText(file)}`);
        }

        if (varDec.type) {
            const t = resolveTypeNode(varDec.type, file, fileRelativePath);
            if (!t) {
                throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
            }

            return t;
        }

        throw new Error("TODO: https://github.com/ShaneGH/ts-validator/issues/7");
    }

    throw new Error(`Cannot resolve type for object: ${expr.getFullText(file)}`);
}

export {
    resolveTypeForExpression
}