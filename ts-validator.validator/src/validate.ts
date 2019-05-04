import {
    AliasedType,
    CompilerArgs,
    LazyTypeReference,
    MultiType,
    MultiTypeCombinator,
    Properties,
    PropertyKeyword,
    PropertyType,
    TypedLookup,
} from 'ts-validator.core';

type Err = {
    property: string
    error: string
    value: any
}

type ValidateState = {
    compilerArgs: CompilerArgs
    complete: TypedLookup<any, PropertyType[]>
};

function validateKeyword(value: any, keyword: PropertyKeyword, state: ValidateState): Err[] {
    if (value == null && !state.compilerArgs.strictNullChecks) {
        return [];
    }
    
    return keyword.validate(value)
        ? []
        : [{ property: "", error: `Value is not a ${keyword.keyword}`, value }];
}

function validateMultiType(value: any, propertyType: MultiType, state: ValidateState): Err[] {
    switch (propertyType.combinator) {
        case MultiTypeCombinator.Intersection:

            return propertyType.types
                .map(x => validate(value, x, state))
                .reduce((s, xs) => s.concat(xs), []);
            
        case MultiTypeCombinator.Union:
            for (var i = 0; i < propertyType.types.length; i++) {
                if (validate(value, propertyType.types[i], state).length === 0) {
                    return [];
                }
            }
            
            return [{ property: "", error: `Value does not match any Union type cases`, value }];

        default:
            throw new Error(`Invalid complex type combinator: ${propertyType.combinator}`);
    }
}

function validate(value: any, propertyType: PropertyType, state: ValidateState): Err[] {

    // check for existing validations for this object
    const added = state.complete.add(value, [], (x, _) => x);
    if (!added.isNew) {
        for (var i = 0; i < added.value.length; i++) {
            if (added.value[i].equals(propertyType)) {
                return [];
            }
        }
    } 
    
    added.value.push(propertyType);

    if (value == null && !state.compilerArgs.strictNullChecks) {
        return [];
    }

    if (propertyType instanceof PropertyKeyword) {
        return validateKeyword(value, propertyType, state);
    }
    
    if (propertyType instanceof LazyTypeReference) {
        return validate(value, propertyType.getType().aliases, state);
    }

    if (propertyType instanceof MultiType) {
        return validateMultiType(value, propertyType, state);
    }

    if (value == null) {
        return [{ property: "", error: `Value cannot be null or undefined`, value }];
    }
    
    if (propertyType instanceof Properties) {

        return propertyType.properties
            .map(x => {
                const pv = value[x.name];
                if (pv == null && x.optional) {
                    return [];
                }

                return validate(pv, x.type, state)
                    .map(err => ({
                        ...err,
                        property: (/^[\$a-z_]([\$a-z_0-9]*)$/i.test(x.name)
                            ? "." + x.name
                            : `["${x.name.replace(/\\/, '\\\\').replace(/"/, '\\"')}"]`) + err.property
                    }));
            })
            .reduce((s, xs) => s.concat(xs), []);
    }

    if (!(value instanceof Array)) {
        return [{ property: "", error: `Value is not an array`, value }];
    }

    return value.map((x, i) =>
        validate(x, propertyType.type, state)
            .map(err => ({
                ...err,
                property: `[${i}]${err.property}`
            })))
        .reduce((s, xs) => s.concat(xs), []);
}

function validatePublic(subject: any, type: PropertyType | AliasedType, compilerArgs: CompilerArgs) {

    if (type instanceof AliasedType) {
        type = type.aliases;
    }
    
    return validate(subject, type, { compilerArgs, complete: new TypedLookup<any, PropertyType[]>() })
        .map(x => ({
            ...x,
            property: "$value" + x.property
        }));
}

export {
    CompilerArgs,
    Err,
    validatePublic as validate
}