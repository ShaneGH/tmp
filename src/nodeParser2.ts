import * as ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { visitNodesInScope } from './utils/astUtils';
import { resolveType as resolveTypeNode, Type } from './nodeParser';


function pad(text: string, pad: number) {
    var p = "";
    for (var i = 0; i < pad; i++) p += "  ";

    return text.split("\n").map(x => pad + "-" + p + x).join("\n");
}

function print(node: ts.Node, recurse = true, level = 0) {
    console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
    if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
}

type LiteralValueKeyword =
    "string" 
    | "number"
    | "boolean" 
    | "any" 
    | "null" 
    | "undefined" 

const propertyKeywords: {[key: number]: LiteralValueKeyword} = {};
propertyKeywords[ts.SyntaxKind.StringLiteral] = "string";
propertyKeywords[ts.SyntaxKind.NumericLiteral] = "number";
propertyKeywords[ts.SyntaxKind.TrueKeyword] = "boolean";
propertyKeywords[ts.SyntaxKind.FalseKeyword] = "boolean";
propertyKeywords[ts.SyntaxKind.NullKeyword] = "null";
propertyKeywords[ts.SyntaxKind.UndefinedKeyword] = "undefined";

// TODO: not sure how this function deals with the var
// keyword, and multiple usages of the same word
function findVariableDeclaration(variable: ts.Identifier) {
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
            
            // TODO
            throw new Error(`Binding patterns are not supported: ${x.getText()}`);
        }
    });
}

function resolveType(expr: ts.Expression): Type {
    // TODO: node might be: getSomething() (from validate call validate(getSomething()))
    if (propertyKeywords[expr.kind]) {
        return {
            name: propertyKeywords[expr.kind],
            properties: propertyKeywords[expr.kind],
            extends: []
        };
    }

    if (ts.isIdentifier(expr)) {
        // undefined is handled a little differently
        if (expr.escapedText.toString() === "undefined") {
            return {
                name: propertyKeywords[ts.SyntaxKind.UndefinedKeyword],
                properties: propertyKeywords[ts.SyntaxKind.UndefinedKeyword],
                extends: []
            };
        }

        const varDec = findVariableDeclaration(expr);
        if (varDec) {
            if (varDec.type) {
                const t = resolveTypeNode(varDec.type);
                if (!t) {
                    throw new Error(`Cannot find type for variable: ${expr.getText()}`);
                }

                return t;
            }

            throw new Error("TODO: declarations with implicit type");
        }
        
        // TODO: object might be from function arg
        // TODO: object might be from import statement
        throw new Error(`Cannot find declaration of object: ${expr.getFullText()}`);
    }

    throw new Error(`Cannot resolve type for object: ${expr.getFullText()}`);
}

export {
    resolveType,
    Type
}