import { validate as validateType, CompilerArgs } from "./src/validate";
import { moduleName } from "./src/const";
import { AliasedType, LazyDictionary, WrapperKind, deserialize } from "ts-validator.core";

let 
	_keyMap: {[k: string]: string} = null as any,
	_types: LazyDictionary<AliasedType> = null as any,
	_compilerArgs: CompilerArgs = null as any;

let initialized = false;
export function init(keyMap: {[k: string]: string}, types: {[k: string]: WrapperKind<any>}, compilerArgs: CompilerArgs) {
	if (initialized) return;
	initialized = true;

	_keyMap = keyMap;
	_types = deserialize(types);
	_compilerArgs = compilerArgs;
}

export function validate<T>(subject: T, key?: string) {
    if (arguments.length < 2) {
        throw new Error("This function should have been replaced with a different validation function. Do you need to re-compile your ts code?");
    }
	
	if (!initialized) {
        throw new Error(`${moduleName} has not been initialized. Do you need to re-compile your ts code?`);
    }

	if (!key) {
		throw new Error("There was no key specified for validation. Do you need to re-compile your ts code?")
	}

	const map = _keyMap[key];
	if (!map) {
		throw new Error(`Invalid validation key ${key}. Do you need to re-compile your ts code?`);
	}

	const type = _types.tryGet(map);
	if (!type) {
		throw new Error(`Could not find type for validation key ${key}, type key ${map}. Do you need to re-compile your ts code?`);
	}

	const errors = validateType(subject, type(), _compilerArgs);
	return {
		success: errors.length == 0,
		errors
	};
}

// https://github.com/ShaneGH/ts-validator/issues/44
// export function is<T> (subject: any, key?: string): subject is T {
// 	return validate(subject, key).success;
// }