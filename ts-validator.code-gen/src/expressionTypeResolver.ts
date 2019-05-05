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

class Any {
    static any = new Any();
    __any: true
    private constructor(){}

    static isAny(x: any) : x is Any { return x instanceof Any; }
}
function tryFindFunctionDeclaration (call: ts.CallExpression, file: ts.SourceFile) {
    // https://github.com/ShaneGH/ts-validator/issues/48
    if (!ts.isIdentifier(call.expression)) return null;

    const fResult = findVariableDeclaration(call.expression, file);
    if (!fResult) return null;

    if (ts.isParameter(fResult) || ts.isVariableDeclaration(fResult)) {
        let ty = fResult.type;
        if (!ty) return Any.any;
        
        while (ts.isParenthesizedTypeNode(ty)) ty = ty.type;
        if (ts.isFunctionTypeNode(ty)) return ty;

        throw new Error(`Expected type: ${ty.getFullText(file)} to be a function type.`);
    }

    return fResult;
}

// TODO: not sure how this function deals with the var
// keyword, and multiple usages of the same word
// https://github.com/ShaneGH/ts-validator/issues/35
function findVariableDeclaration(variable: ts.Identifier, file: ts.SourceFile) {

    const variableName = variable.escapedText.toString();
    return visitNodesInScope(variable, x => {

        if (ts.isFunctionExpression(x) || ts.isFunctionDeclaration(x) || ts.isArrowFunction(x)) {
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
    }) || null;
}

function tryResolveForImplicitTypeInCallback(param: ts.ParameterDeclaration | ts.VariableDeclaration, sourceFile: ts.SourceFile): TypeExpression | null {
    // param: y
    if (!ts.isParameter(param)) return null;

    const callbacks: (ts.ArrowFunction | ts.FunctionExpression)[] = [];
    function getCall(input: ts.Node): ts.FunctionTypeNode | null {
        
        if (!input.parent) return null;

        if (ts.isArrowFunction(input.parent) || ts.isFunctionExpression(input.parent)) {
            callbacks.splice(0, 0, input.parent);
        }

        if (ts.isCallExpression(input.parent)) {
            const argIndex = input.parent.arguments.indexOf(input as any);
            if (argIndex === -1) throw new Error(`Could not find argument index for ${input.getFullText(sourceFile)}`);
            const functionDefinition = tryFindFunctionDeclaration(input.parent, sourceFile);
            if (!functionDefinition || Any.isAny(functionDefinition)) return null;

            let ty = functionDefinition.parameters[argIndex].type;
            if (!ty) return null;
            ty = removeTypeParentiesis(ty);

            if (ty.kind === ts.SyntaxKind.AnyKeyword) return null;
            if (!ts.isFunctionTypeNode(ty)) {
                throw new Error(`Expected type: ${ty.getFullText(sourceFile)} to be a function type.`);
            }
            
            return ty;
        }

        return getCall(input.parent);
    }

    function getParameterPosition () {
        for (let callback = 0; callback < callbacks.length; callback++) {
            let arg = callbacks[callback].parameters.indexOf(param as any);
            if (arg !== -1) return { callback, arg }
        }
    }

    const callbackType = getCall(param);
    if (callbackType === null) return null; // this will happen if the function is not a callback or is untyped
    const position = getParameterPosition();
    if (!position) throw new Error(`Could not find declaration of parameter: ${param.getFullText(sourceFile)}`);

    let i = 0;
    let callback = callbackType;

    // find type for callback which defines our arg
    for (; i < position.callback; i++) {

        let ty = removeTypeParentiesis(callback.type);
        if (!ts.isFunctionTypeNode(ty)) {
            throw new Error(`Expected: ${ty.getFullText(sourceFile)} to be a function type node.`);
        }

        callback = ty;
    }

    // see if there is an override for callback when the 
    // callback is declared
    const explicitCallbackType = tryFindTypeFromPreviousCallbacks(
        callbacks.slice(0, i + 1),
        position.arg,
        sourceFile);

    if (explicitCallbackType) {
        return Any.isAny(explicitCallbackType) ? null : explicitCallbackType;
    }
    
    if (callback.parameters.length - 1 < position.arg) {
        throw new Error(`Could not find type for argument: ${param.getFullText(sourceFile)}`);
    }

    const type = callback.parameters[position.arg].type;
    if (!type) return null;

    return new TypeNode(
        removeTypeParentiesis(type), 
        !!callback.parameters[position.arg].questionToken);
}

function tryFindTypeFromPreviousCallbacks(callbacks: (ts.ArrowFunction | ts.FunctionExpression)[], argPosition: number, sourceFile: ts.SourceFile) {
    // see if there is an override for callback when the 
    // callback is declared
    for (let i = callbacks.length - 1; i >= 0; i--) {
        let ty = callbacks[i].type;
        if (!ty) {
            continue;
        }
        
        ty = removeTypeParentiesis(ty);
        for (let j = i; j < callbacks.length - 2; j++) {
            if (ty.kind === ts.SyntaxKind.AnyKeyword) {
                return Any.any;
            }

            if (!ts.isFunctionTypeNode(ty)) {
                throw new Error(`Expected: ${ty.getFullText(sourceFile)} to be a function type node.`);
            }

            ty = removeTypeParentiesis(ty.type);
        }
        
        if (ty.kind === ts.SyntaxKind.AnyKeyword) {
            return Any.any;
        }

        if (!ts.isFunctionTypeNode(ty)) {
            throw new Error(`Expected: ${ty.getFullText(sourceFile)} to be a function type node.`);
        }

        if (argPosition >= ty.parameters.length) {
            throw new Error(`Expected: ${ty.getFullText(sourceFile)} to have at least ${argPosition} parameters.`);
        }

        const t = ty.parameters[argPosition].type;
        if (!t) return Any.any;
        return ty
            ? new TypeNode(t, !!ty.parameters[argPosition].questionToken)
            : Any.any;
    }

    return null;
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
    
    if (ts.isFunctionDeclaration(varDec) || ts.isFunctionExpression(varDec) || ts.isArrowFunction(varDec)) {
        //TODO: not sure how to reach this condition
        throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
    }

    return resolveForParameter(varDec, file);
}

function resolveForParameter(varDec: ts.ParameterDeclaration | ts.VariableDeclaration, file: ts.SourceFile) {

    if (varDec.type) {
        return new TypeNode(varDec.type, ts.isParameter(varDec) && varDec.questionToken != null);
    } else if (varDec.initializer) {
        return resolveTypeForExpression(varDec.initializer, file);
    } else {
        return tryResolveForImplicitTypeInCallback(varDec, file)
            || new UnknownExpression(ts.SyntaxKind.AnyKeyword);
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

        if (ts.isFunctionDeclaration(varDec) || ts.isArrowFunction(varDec) || ts.isFunctionExpression(varDec)) {
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

function removeTypeParentiesis(node: ts.TypeNode) {
    
    while (ts.isParenthesizedTypeNode(node)) node = node.type;
    return node;
}

function removeExpressionParentiesis(node: ts.Expression) {
    
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
}

function removeParentiesisFromTypeExpression(node: TypeExpression){
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
        return removeParentiesisFromTypeExpression(
            resolveForIdentifier(expr, file));
    }

    if (ts.isAsExpression(expr) 
        || ts.isTypeAssertion(expr)) {
        return removeParentiesisFromTypeExpression(new TypeNode(expr.type, false));
    }

    if (ts.isObjectLiteralExpression(expr)
        || ts.isArrayLiteralExpression(expr)) {
        return expr;
    }

    if (ts.isCallExpression(expr)) {
        return removeParentiesisFromTypeExpression(
            resolveForCall(expr, file));
    }

    return new UnknownExpression(expr.kind);
}

export {
    resolveTypeForExpression,
    TypeExpression
}