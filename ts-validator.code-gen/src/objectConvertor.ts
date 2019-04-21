import * as ts from "typescript"
import { PropertyKeyword, Properties, Property, PropertyType, ArrayType, MultiType, MultiTypeCombinator } from "ts-validator.core"
import { UnknownExpression } from "./expressionTypeResolver";

// TODO: this is a copy paste of values in expressionTypeResolver
const propertyKeywords: {[key: number]: PropertyKeyword} = {};
propertyKeywords[ts.SyntaxKind.StringLiteral] = PropertyKeyword.string;
propertyKeywords[ts.SyntaxKind.NumericLiteral] = PropertyKeyword.number;
propertyKeywords[ts.SyntaxKind.TrueKeyword] = PropertyKeyword.boolean;
propertyKeywords[ts.SyntaxKind.FalseKeyword] = PropertyKeyword.boolean;
propertyKeywords[ts.SyntaxKind.NullKeyword] = PropertyKeyword.null;
propertyKeywords[ts.SyntaxKind.UndefinedKeyword] = PropertyKeyword.undefined;
propertyKeywords[ts.SyntaxKind.AnyKeyword] = PropertyKeyword.any;
propertyKeywords[ts.SyntaxKind.NoSubstitutionTemplateLiteral] = PropertyKeyword.string;
propertyKeywords[ts.SyntaxKind.TemplateExpression] = PropertyKeyword.string;

function resolveExpression(expr: ts.Expression, file: ts.SourceFile): PropertyType {
    if (propertyKeywords[expr.kind]) {
        return propertyKeywords[expr.kind];
    }
    
    if (ts.isObjectLiteralExpression(expr)) {
        return resolveObject(expr, file);
    }
    
    if (ts.isArrayLiteralExpression(expr)) {
        return resolveArray(expr, file);
    }

    throw new Error(`Unknown ${ts.SyntaxKind[expr.kind]}`);
}

function resolveArray(expr: ts.ArrayLiteralExpression, file: ts.SourceFile): ArrayType {
    const types = expr.elements
        .map(x => resolveExpression(x, file))
        .reduce((s, x) => {
            for (var i = 0; i < s.length; i++) {
                if (s[i].equals(x)) return s;
            }

            s.push(x);
            return s;
        }, [] as PropertyType[]);

    if (types.length === 0) {
        return new ArrayType(PropertyKeyword.never);
    }

    if (types.length === 1) {
        return new ArrayType(types[0]);
    }

    return new ArrayType(new MultiType(types, MultiTypeCombinator.Union));
}

function resolveObject(expr: ts.ObjectLiteralExpression, file: ts.SourceFile): Properties {
    return new Properties(expr.properties.map(p => {
        if (ts.isPropertyAssignment(p)) {
            const name = ts.isIdentifier(p.name)
                ? p.name.text
                : ts.isStringLiteral(p.name)
                    ? p.name.text
                    : ts.isNumericLiteral(p.name)
                        ? p.name.text
                        : null;

            if (name === null) throw new Error(`Cannot resolve name for property, ${ts.SyntaxKind[p.kind]}: ${p.getFullText(file)}`);

            return new Property(name, resolveExpression(p.initializer, file));
        }

        throw new Error(`Cannot resolve type for property, ${ts.SyntaxKind[p.kind]}: ${p.getFullText(file)}`);
    }));
}

function resolveObjectOrArray(expr: ts.ObjectLiteralExpression | ts.ArrayLiteralExpression | UnknownExpression, file: ts.SourceFile) {
    if (expr instanceof UnknownExpression) {
        if (propertyKeywords[expr.kind]) {
            return propertyKeywords[expr.kind];
        }

        throw new Error(`Cannot resolve expression for syntax kind ${expr.kind}, ${ts.SyntaxKind[expr.kind]}`);
    }

    return resolveExpression(expr, file);
}

export {
    resolveObjectOrArray as resolveObject
}