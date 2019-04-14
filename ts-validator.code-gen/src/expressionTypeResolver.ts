import * as ts from 'typescript';
import { visitNodesInScope } from './utils/astUtils';
import { PropertyKeyword, Properties } from 'ts-validator.core';


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
            
            throw new Error(`Binding patterns are not supported: ${x.getText(file)}`);
        }
    });
}

type ObjectCreationProperty<T> = { name: string, value: T | PropertyKeyword | ObjectCreation<T> }; 
class ObjectCreation<T> {
    constructor(public values: ObjectCreationProperty<T>[]) { }
}

function resolveTypeForExpression<T>(expr: ts.Expression, file: ts.SourceFile) {
    return function (resolve: (type: ts.TypeNode) => T | null): T | PropertyKeyword | ObjectCreation<T> {

        if (ts.isIdentifier(expr)) {
            // undefined is handled a little differently
            if (expr.escapedText.toString() === "undefined") {
                return propertyKeywords[ts.SyntaxKind.UndefinedKeyword];
            }
            
            const varDec = findVariableDeclaration(expr, file);
            if (!varDec) {
                throw new Error(`Cannot find declaration of variable: ${expr.getFullText(file)}`);
            }

            if (varDec.type) {
                const t = resolve(varDec.type);
                if (!t) {
                    throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
                }

                return t;
            } else if (varDec.initializer) {
                return resolveTypeForExpression<T>(varDec.initializer, file)(resolve);
            }
        }

        if (ts.isAsExpression(expr) || ts.isTypeAssertion(expr)) {
            const t = resolve(expr.type);
            if (!t) {
                throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
            }

            return t;
        }

        if (propertyKeywords[expr.kind]) {
            return propertyKeywords[expr.kind];
        }

        if (ts.isObjectLiteralExpression(expr)) {
            return new ObjectCreation<T>(expr.properties.map(p => {
                if (ts.isPropertyAssignment(p)) {
                    //Identifier | StringLiteral | NumericLiteral | ComputedPropertyName
                    const name = ts.isIdentifier(p.name)
                        ? p.name.text
                        : ts.isStringLiteral(p.name)
                            ? p.name.text
                            : ts.isNumericLiteral(p.name)
                                ? p.name.text
                                : null;

                    if (name === null) throw new Error(`Cannot resolve name for property, ${ts.SyntaxKind[p.kind]}: ${p.getFullText(file)}`);

                    return {
                        name,
                        value: resolveTypeForExpression<T>(p.initializer, file)(resolve)
                    };
                }

                throw new Error(`Cannot resolve type for property, ${ts.SyntaxKind[p.kind]}: ${p.getFullText(file)}`);
            }));
        }

        throw new Error(`Cannot resolve type for object, ${ts.SyntaxKind[expr.kind]}: ${expr.getFullText(file)}`);
    }
}

export {
    ObjectCreation,
    ObjectCreationProperty,
    resolveTypeForExpression
}