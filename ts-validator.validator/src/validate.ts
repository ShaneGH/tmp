import { PropertyKeyword, PropertyType, MultiType, MultiTypeCombinator, LazyTypeReference, ArrayType, Properties, AliasedType, CompilerArgs } from "ts-validator.core";

type Err = {
    property: string
    error: string
    value: any
}

function validateKeyword(value: any, keyword: PropertyKeyword, compilerArgs: CompilerArgs): Err[] {
    if (value == null && !compilerArgs.strictNullChecks) {
        return [];
    }
    
    return keyword.validate(value)
        ? []
        : [{ property: "", error: `Value is not a ${keyword.keyword}`, value }];
}

function validateMultiType(value: any, propertyType: MultiType, compilerArgs: CompilerArgs): Err[] {
    switch (propertyType.combinator) {
        case MultiTypeCombinator.Intersection:

            return propertyType.types
                .map(x => validateProperty(value, x, compilerArgs))
                .reduce((s, xs) => s.concat(xs), []);
            
        case MultiTypeCombinator.Union:
            for (var i = 0; i < propertyType.types.length; i++) {
                if (validateProperty(value, propertyType.types[i], compilerArgs).length === 0) {
                    return [];
                }
            }
            
            return [{ property: "", error: `Value does not match Union type`, value }];

        default:
            throw new Error(`Invalid complex type combinator: ${propertyType.combinator}`);
    }
}

function validateProperty(value: any, propertyType: PropertyType, compilerArgs: CompilerArgs): Err[] {
    if (value == null && !compilerArgs.strictNullChecks) {
        return [];
    }

    if (propertyType instanceof PropertyKeyword) {
        return validateKeyword(value, propertyType, compilerArgs);
    }
    
    if (propertyType instanceof LazyTypeReference) {
        return validate(value, propertyType.getType(), compilerArgs);
    }

    if (value == null) {
        return [{ property: "", error: `Value cannot be null or undefined`, value }];
    }
    
    if (propertyType instanceof Properties) {

        return propertyType.properties
            .map(x => {
                const pv = value[x.name];
                return validateProperty(pv, x.type, compilerArgs)
                    .map(err => ({
                        ...err,
                        property: err.property + (/^[\$a-z_]([\$a-z_0-9]*)$/i.test(x.name)
                            ? "." + x.name
                            : `["${x.name.replace(/\\/, '\\\\').replace(/"/, '\\"')}"]`)
                    }));
            })
            .reduce((s, xs) => s.concat(xs), []);
    }

    if (propertyType instanceof ArrayType) {
        if (!(value instanceof Array)) {
            return [{ property: "", error: `Value is not an array`, value }];
        }

        return value.map((x, i) =>
            validate(x, propertyType.type, compilerArgs)
            .map(err => ({
                ...err,
                property: `${err.property}[${i}]`
            })))
            .reduce((s, xs) => s.concat(xs), []);
    }
    
    return validateMultiType(value, propertyType, compilerArgs);
}

function validate(subject: any, type: PropertyType | AliasedType, compilerArgs: CompilerArgs) {

    if (type instanceof AliasedType) {
        type = type.aliases;
    }

    return validateProperty(subject, type, compilerArgs);
}

export {
    CompilerArgs,
    Err,
    validate
}