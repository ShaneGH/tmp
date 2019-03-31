import { Type, PropertyKeyword, TypeWrapper, PropertyType } from "../validation-rewriter/types";
import { LazyDictionary } from "../utils/lazyDictionary";

let validationConstants: {
    types: LazyDictionary<string, Type>,
    keyMap: {[key: string]: string}
 } | null = null;

function init(types: LazyDictionary<string, Type>, keyMap: {[key: string]: string}) {
    validationConstants = {
        types,
        keyMap
    };
}

function getType(key: string): Type {
    if (!validationConstants) {
        throw new Error("You must call \"init(...)\" in order to initialize the validation.");
    }

    if (!key) {
        throw new Error("There was no key specified for validation. Do you need to re-compile your ts code?");
    }

    const map = validationConstants.keyMap[key];
    if (!map) {
        throw new Error(`Invalid validation key ${key}. Do you need to re-compile your ts code?`);
    }

    const type = validationConstants.types.tryGet(map);
    if (!type) {
        throw new Error(`Could not find type for validation key ${key}, type key ${map}. Do you need to re-compile your ts code?`);
    }

    return type();
}

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

function validate(subject: any, key: string | Type, compilerArgs: CompilerArgs) {
    if (typeof key === "string") {
        key = getType(key);
    }

    if (subject == null) {
        if (!compilerArgs.strictNullChecks) {
            return true;
        }

        // TODO: check if type extends null or undefined
        return false;
    }
    
    for (let i = 0; i < key.properties.length; i++) {
        if (!validateProperty(subject[key.properties[i].name], key.properties[i].type, compilerArgs)) {
            return false;
        }
    }

    for (let i = 0; i < key.extends.length; i++) {
        const ex = key.extends[i];
        if (ex instanceof TypeWrapper) {
            if (!validate(subject, ex.getType(), compilerArgs)) {
                return false;
            }

            continue;
        }

        if (!ex.validate(subject)) {
            return false;
        }
    }

    return true;
}

export {
    CompilerArgs,
    init,
    validate
}