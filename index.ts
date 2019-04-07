import { validate as validateType } from "./src/validator/validate";
import { keyMap as km, types as ty, compilerArgs as ca } from "./types";

if (!km || !ty || !ca) {
    throw new Error("Types have not been generated for this project. Do you need to re-compile your ts code?");    
}

const keyMap = km, types = ty, compilerArgs = ca;

function validate<T>(subject: T, key?: string): boolean {
    if (arguments.length < 2) {
        throw new Error("This function should have been replaced with a different validation function. Do you need to re-compile your ts code?");
    }

	if (!key) {
		throw new Error("There was no key specified for validation. Do you need to re-compile your ts code?")
	}

	const map = keyMap[key];
	if (!map) {
		throw new Error(`Invalid validation key ${key}. Do you need to re-compile your ts code?`);
	}

	const type = types.tryGet(map);
	if (!type) {
		throw new Error(`Could not find type for validation key ${key}, type key ${map}. Do you need to re-compile your ts code?`);
	}

	return validateType(subject, type(), compilerArgs);
}


export {
    validate
}