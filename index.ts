import { validate as validateType } from "./src/validator/validate";
import { deserialize } from "./src/validation-rewriter/typeSerializer";

function validate<T>(subject: T): boolean {
    throw new Error("This function should have been replaced with a different validation function. Do you need to re-compile your ts code?");
}

export {
    deserialize,
    validate,
    validateType
}