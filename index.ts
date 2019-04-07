import { validate as validateType, CompilerArgs } from "./src/validator/validate";
import { deserialize, SerializableType } from "./src/validation-rewriter/typeSerializer";
import { moduleName } from "./src/const";
import { LazyDictionary } from "./src/utils/lazyDictionary";
import { Type } from "./src/validation-rewriter/types";

let 
	_keyMap: {[k: string]: string} = null as any,
	_types: LazyDictionary<string, Type> = null as any,
	_compilerArgs: CompilerArgs = null as any;

let initialized = false;
function init(keyMap: {[k: string]: string}, types: {[k: string]: SerializableType}, compilerArgs: CompilerArgs) {
	if (initialized) return;
	initialized = true;

	_keyMap = keyMap;
	_types = deserialize(types);
	_compilerArgs = compilerArgs;
}

function validate<T>(subject: T, key?: string): boolean {
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

	return validateType(subject, type(), _compilerArgs);
}

export {
	init,
    validate
}