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
// https://github.com/ShaneGH/ts-validator/issues/35
function findVariableDeclaration(variable: ts.Identifier, file: ts.SourceFile) {

    const variableName = variable.escapedText.toString();
    return visitNodesInScope(variable, x => {

        if (ts.isFunctionDeclaration(x) || ts.isArrowFunction(x)) {
            if (x.name && x.name.text === variableName) {
                return x;
            }

            for (var i = 0; i < x.parameters.length; i++) {
                const p = x.parameters[i];
                if (!ts.isIdentifier(p.name)) {
                    throw new Error(`Binding patterns are not supported: ${x.getText(file)}`);
                }

                if (p.name.text === variableName) {
                    return p;
                }
            }
        }

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

type ObjectCreationProperty<T> = { name: string, value: T | PropertyKeyword | ObjectCreation<T> | ArrayCreation<T> };
class ObjectCreation<T> {
    constructor(public values: ObjectCreationProperty<T>[]) { }
}

type ArrayElementType<T> = T | PropertyKeyword;
class ArrayCreation<T> {
    constructor(public types: ArrayElementType<T>[]) { }
}

function resolveForIdentifier<T>(expr: ts.Identifier, file: ts.SourceFile, resolve: (x: ts.TypeNode) => T){
            
    // undefined is handled a little differently
    if (expr.escapedText.toString() === "undefined") {
        return propertyKeywords[ts.SyntaxKind.UndefinedKeyword];
    }
    
    const varDec = findVariableDeclaration(expr, file);
    if (!varDec) {
        throw new Error(`Cannot find declaration of variable: ${expr.getFullText(file)}`);
    }

    if (varDec.type) {
        return resolve(varDec.type);
    } else if (ts.isFunctionDeclaration(varDec) || ts.isArrowFunction(varDec)) {
        //TODO: not sure how to reach this condition
        throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
    } else {
        if (varDec.initializer) {
            return resolveTypeForExpression<T>(varDec.initializer, file)(resolve);
        } else {
            return PropertyKeyword.any;
        }
    }
}

function resolveForObjectLiteral<T>(expr: ts.ObjectLiteralExpression, file: ts.SourceFile, resolve: (x: ts.TypeNode) => T){

    return new ObjectCreation<T>(expr.properties.map(p => {
        if (ts.isPropertyAssignment(p)) {
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

function resolveForCall<T>(expr: ts.CallExpression, file: ts.SourceFile, resolve: (x: ts.TypeNode) => T){
    let expression: ts.Expression = expr.expression;
    while (ts.isParenthesizedExpression(expression)) expression = expression.expression;

    if (ts.isIdentifier(expression)) {
        const varDec = findVariableDeclaration(expression, file);
        if (!varDec) {
            throw new Error(`Cannot find declaration of variable: ${expr.getFullText(file)}`);
        }

        if (ts.isFunctionDeclaration(varDec) || ts.isArrowFunction(varDec)) {
            if (varDec.type) {
                return resolve(varDec.type);
            }
                                
            throw new Error(`Implicit function return values are not supported. Please specify the function return type explicitly: ${varDec.getFullText(file)}.`);
        }

        if (varDec.type) {
            let type = varDec.type;
            while (ts.isParenthesizedTypeNode(type)) type = type.type;

            if (ts.isFunctionTypeNode(type)) {
                return resolve(type.type);
            }
        }

        
        if (varDec.initializer) {
            let initializer = varDec.initializer;
            while (ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;

            if (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer)) {
                if (initializer.type) {
                    return resolve(initializer.type);
                }
                
                throw new Error(`Implicit function return values are not supported. Please specify the function return type explicitly: ${varDec.initializer.getFullText(file)}.`);
            }
        }

        throw new Error(`Expecting object ${ts.SyntaxKind[varDec.kind]}, ${varDec.getFullText(file)} to be a function or arrow function.`);
    } else if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) {
        if (expression.type) {
            return resolve(expression.type);
        }
        
        throw new Error(`Implicit function return values are not supported. Please specify the function return type explicitly: ${expression.getFullText(file)}.`);
    }
    
    // TODO: is there a case for this branch of logic?
    throw new Error(`Cannot resolve type for object, ${ts.SyntaxKind[expr.kind]}: ${expr.getFullText(file)}`);
}

function resolveTypeForExpression<T>(expr: ts.Expression, file: ts.SourceFile) {
    return function (resolve: (type: ts.TypeNode) => T | null): T | PropertyKeyword | ObjectCreation<T> | ArrayCreation<T> {

        while (ts.isParenthesizedExpression(expr)) expr = expr.expression;

        function resolveOrThrow(type: ts.TypeNode) {
            while (ts.isParenthesizedTypeNode(type)) type = type.type;
            
            const t = resolve(type);
            if (!t) {
                throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
            }

            return t;
        }

        if (ts.isIdentifier(expr)) {
            return resolveForIdentifier(expr, file, resolveOrThrow);
        }

        if (ts.isAsExpression(expr) || ts.isTypeAssertion(expr)) {
            return resolveOrThrow(expr.type);
        }

        if (propertyKeywords[expr.kind]) {
            return propertyKeywords[expr.kind];
        }

        if (ts.isObjectLiteralExpression(expr)) {
            return resolveForObjectLiteral(expr, file, resolveOrThrow);
        }

        if (ts.isArrayLiteralExpression(expr)) {
            return new ArrayCreation<T>([]);
        }

        if (ts.isCallExpression(expr)) {
            return resolveForCall(expr, file, resolveOrThrow);
        }

        throw new Error(`Cannot resolve type for object, ${ts.SyntaxKind[expr.kind]}: ${expr.getFullText(file)}`);
    }
}

export {
    ArrayCreation,
    ArrayElementType,
    ObjectCreation,
    ObjectCreationProperty,
    resolveTypeForExpression
}