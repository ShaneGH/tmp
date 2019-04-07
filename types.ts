import { LazyDictionary } from "./src/utils/lazyDictionary";
import { CompilerArgs } from "./src/validator/validate";
import { Type } from "./src/validation-rewriter/types";

const keyMap: {[key: string]: string} | null = null;
const types: LazyDictionary<string, Type> | null = null;
const compilerArgs: CompilerArgs | null = null;

export {
    keyMap,
    types,
    compilerArgs
}