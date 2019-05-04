import * as ts from 'typescript';
import { visitNodesInScope } from './utils/astUtils';


function pad(text: string, pad: number) {
    var p = "";
    for (var i = 0; i < pad; i++) p += "  ";

    return text.split("\n").map(x => pad + "-" + p + x).join("\n");
}

function print(node: ts.Node, recurse = true, level = 0) {
    console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
    if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
}

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
                    // https://github.com/ShaneGH/ts-validator/issues/36
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
            
            // https://github.com/ShaneGH/ts-validator/issues/36
            throw new Error(`Binding patterns are not supported: ${x.getText(file)}`);
        }
    });
}

function resolveForIdentifier(expr: ts.Identifier, file: ts.SourceFile) {
            
    // undefined is handled a little differently
    if (expr.escapedText.toString() === "undefined") {
        return new UnknownExpression(ts.SyntaxKind.UndefinedKeyword);
    }
    
    const varDec = findVariableDeclaration(expr, file);
    if (!varDec) {
        throw new Error(`Cannot find declaration of variable: ${expr.getFullText(file)}`);
    }

    if (varDec.type) {
        return new TypeNode(varDec.type, ts.isParameter(varDec) && varDec.questionToken != null);
    } else if (ts.isFunctionDeclaration(varDec) || ts.isArrowFunction(varDec)) {
        //TODO: not sure how to reach this condition
        throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
    } else if (varDec.initializer) {
        return resolveTypeForExpression(varDec.initializer, file);
    } else {
        return new UnknownExpression(ts.SyntaxKind.AnyKeyword);
    }
}

function resolveForCall(expr: ts.CallExpression, file: ts.SourceFile){
    let expression: ts.Expression = expr.expression;
    while (ts.isParenthesizedExpression(expression)) expression = expression.expression;

    if (ts.isIdentifier(expression)) {
        const varDec = findVariableDeclaration(expression, file);
        if (!varDec) {
            throw new Error(`Cannot find declaration of variable: ${expr.getFullText(file)}`);
        }

        if (ts.isFunctionDeclaration(varDec) || ts.isArrowFunction(varDec)) {
            if (varDec.type) {
                return new TypeNode(varDec.type, false);
            }
                                
            throw new Error(`Implicit function return values are not supported. Please specify the function return type explicitly: ${varDec.getFullText(file)}.`);
        }

        if (varDec.type) {
            let type = varDec.type;
            while (ts.isParenthesizedTypeNode(type)) type = type.type;

            if (ts.isFunctionTypeNode(type)) {
                return new TypeNode(type.type, false);
            }
        }
        
        if (varDec.initializer) {
            let initializer = varDec.initializer;
            while (ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;

            if (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer)) {
                if (initializer.type) {
                    return new TypeNode(initializer.type, false);
                }
                
                throw new Error(`Implicit function return values are not supported. Please specify the function return type explicitly: ${varDec.initializer.getFullText(file)}.`);
            }
        }

        throw new Error(`Expecting object ${ts.SyntaxKind[varDec.kind]}, ${varDec.getFullText(file)} to be a function or arrow function.`);
    } else if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) {
        if (expression.type) {
            return new TypeNode(expression.type, false);
        }
        
        throw new Error(`Implicit function return values are not supported. Please specify the function return type explicitly: ${expression.getFullText(file)}.`);
    }
    
    // TODO: is there a case for this branch of logic?
    throw new Error(`Cannot resolve type for object, ${ts.SyntaxKind[expr.kind]}: ${expr.getFullText(file)}`);
}

function removeParentiesis(node: TypeExpression){
    if (node instanceof UnknownExpression) return node;

    if (node instanceof TypeNode) {
        let n = node;
        while (ts.isParenthesizedTypeNode(n.node)) n.node = n.node.type;
        return n;
    }

    return node;
}

export class UnknownExpression {
    constructor(public syntaxKind: ts.SyntaxKind) {}
}

export class TypeNode {
    constructor(public node: ts.TypeNode, public optional: boolean) {}
}

type TypeExpression = 
    | ts.ObjectLiteralExpression 
    | ts.ArrayLiteralExpression
    | TypeNode
    | UnknownExpression;

function resolveTypeForExpression(expr: ts.Expression, file: ts.SourceFile) : TypeExpression {

    while (ts.isParenthesizedExpression(expr)) expr = expr.expression;

    if (ts.isIdentifier(expr)) {
        return removeParentiesis(
            resolveForIdentifier(expr, file));
    }

    if (ts.isAsExpression(expr) 
        || ts.isTypeAssertion(expr)) {
        return removeParentiesis(new TypeNode(expr.type, false));
    }

    if (ts.isObjectLiteralExpression(expr)
        || ts.isArrayLiteralExpression(expr)) {
        return expr;
    }

    if (ts.isCallExpression(expr)) {
        return removeParentiesis(
            resolveForCall(expr, file));
    }

    return new UnknownExpression(expr.kind);
}

export {
    resolveTypeForExpression,
    TypeExpression
}