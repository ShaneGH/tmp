import { PropertyKeyword, PropertyType, MultiType, MultiTypeCombinator, LazyTypeReference, Properties, AliasedType, CompilerArgs } from "ts-validator.core";

function validateKeyword(value: any, keyword: PropertyKeyword, compilerArgs: CompilerArgs) {
    if (value == null && !compilerArgs.strictNullChecks) {
        return true;
    }
    
    return keyword.validate(value);
}

function validateMultiType(value: any, propertyType: MultiType, compilerArgs: CompilerArgs): boolean {
    switch (propertyType.combinator) {
        case MultiTypeCombinator.Intersection:
            for (var i = 0; i < propertyType.types.length; i++) {
                if (!validateProperty(value, propertyType.types[i], compilerArgs)) {
                    return false;
                }
            }
            
            return true;
            
        case MultiTypeCombinator.Union:
            for (var i = 0; i < propertyType.types.length; i++) {
                if (validateProperty(value, propertyType.types[i], compilerArgs)) {
                    return true;
                }
            }
            
            return false;

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
    
    return validateMultiType(propertyValue, propertyType, compilerArgs);
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