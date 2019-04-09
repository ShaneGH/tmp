import { PropertyKeyword, PropertyType, BinaryType, BinaryTypeCombinator, LazyTypeReference, Properties, AliasedType } from "../validation-rewriter/types";

type CompilerArgs = {
    strictNullChecks: boolean
}

function validateKeyword(value: any, keyword: PropertyKeyword, compilerArgs: CompilerArgs) {
    if (value == null && !compilerArgs.strictNullChecks) {
        return true;
    }
    
    return keyword.validate(value);
}

function validateBinaryType(value: any, propertyType: BinaryType, compilerArgs: CompilerArgs): boolean {
    switch (propertyType.combinator) {
        case BinaryTypeCombinator.Intersection:
            return validateProperty(value, propertyType.left, compilerArgs) &&
                validateProperty(value, propertyType.right, compilerArgs);
            
        case BinaryTypeCombinator.Union:
            return validateProperty(value, propertyType.left, compilerArgs) ||
                validateProperty(value, propertyType.right, compilerArgs);

        default:
            throw new Error(`Invalid complex type combinator: ${propertyType.combinator}`);
    }
}

function validateProperty(propertyValue: any, propertyType: PropertyType, compilerArgs: CompilerArgs): boolean {
    if (propertyValue == null && !compilerArgs.strictNullChecks) {
        return true;
    }

    if (propertyType instanceof PropertyKeyword) {
        return validateKeyword(propertyValue, propertyType, compilerArgs);
    }
    
    if (propertyType instanceof LazyTypeReference) {
        return validate(propertyValue, propertyType.getType(), compilerArgs);
    }

    if (propertyValue == null) {
        return false;
    }
    
    if (propertyType instanceof Properties) {
        for (var i = 0; i < propertyType.properties.length; i++) {
            const pv = propertyValue[propertyType.properties[i].name];
            if (!validateProperty(pv, propertyType.properties[i].type, compilerArgs)) {
                return false;
            }
        }

        return true;
    }
    
    return validateBinaryType(propertyValue, propertyType, compilerArgs);
}

function validate(subject: any, type: PropertyType | AliasedType, compilerArgs: CompilerArgs) {

    if (type instanceof AliasedType) {
        type = type.aliases;
    }

    return validateProperty(subject, type, compilerArgs);
}

export {
    CompilerArgs,
    validate
}