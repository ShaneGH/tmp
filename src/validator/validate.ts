import { Type, PropertyKeyword, TypeWrapper, PropertyType, BinaryType, BinaryTypeCombinator, ExtendsTypes } from "../validation-rewriter/types";

type CompilerArgs = {
    strictNullChecks: boolean
}

function validateKeyword(value: any, keyword: PropertyKeyword, compilerArgs: CompilerArgs) {
    if (value == null && !compilerArgs.strictNullChecks) {
        return true;
    }
    
    return keyword.validate(value);
}

function validateProperty(propertyValue: any, propertyType: PropertyType, compilerArgs: CompilerArgs) {
    if (propertyValue == null && !compilerArgs.strictNullChecks) {
        return true;
    }

    if (propertyType instanceof PropertyKeyword) {
        return validateKeyword(propertyValue, propertyType, compilerArgs);
    }
    
    if (propertyType instanceof TypeWrapper) {
        return validate(propertyValue, propertyType.getType(), compilerArgs);
    }

    if (propertyValue == null) {
        return false;
    }

    for (var i = 0; i < propertyType.properties.length; i++) {
        const pv = propertyValue[propertyType.properties[i].name];
        if (!validateProperty(pv, propertyType.properties[i].type, compilerArgs)) {
            return false;
        }
    }

    return true;
}

function validate(subject: any, type: Type, compilerArgs: CompilerArgs) {
    
    function validateExtends(type: ExtendsTypes) {
        if (type instanceof TypeWrapper) {
            if (!validate(subject, type.getType(), compilerArgs)) {
                return false;
            }
        } else if (type instanceof PropertyKeyword) {
            if (!type.validate(subject)) {
                return false;
            }
        } else {
            switch (type.combinator) {
                case BinaryTypeCombinator.Intersection:
                    const intersectionResult = 
                         validateExtends(type.left) &&
                         validateExtends(type.right);

                    if (!intersectionResult) return false;
                    break;
                    
                case BinaryTypeCombinator.Union:
                    const unionResult = 
                         validateExtends(type.left) ||
                         validateExtends(type.right);

                    if (!unionResult) return false;
                    break;

                default:
                    throw new Error(`Invalid complex type combinator: ${type.combinator}`);
            }
        }

        return true;
    }

    if (subject == null) {
        if (!compilerArgs.strictNullChecks) {
            return true;
        }

        // TODO: check if type extends null or undefined
        return  false;
    }
    
    for (let i = 0; i < type.properties.length; i++) {
        if (!validateProperty(subject[type.properties[i].name], type.properties[i].type, compilerArgs)) {
            return false;
        }
    }

    if (type.extends) {
        if (!validateExtends(type.extends)) {
            return false;
        }
    }

    return true;
}

export {
    CompilerArgs,
    validate
}