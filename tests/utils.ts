import * as ts from 'typescript';
import * as chai from 'chai';
import { validate as validate, Err } from '../ts-validator.validator/src/validate';
import { generateFilesAndTypes } from '../ts-validator.code-gen/src/executor';
import { CodeWriter } from '../ts-validator.code-gen/src/clientSideValidator';
import { CompilerArgs, deserialize, serialize, Type, AliasedType } from 'ts-validator.core';

chai.should();

function createFile(text: string) {
    return ts.createSourceFile(
        'testFile.ts', text, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
    );
}

type ScenarioArgs = {
    validateSetup?: string
    validateTeardown?: string
    validateGeneric?: string
    /* default: true */
    serialize?: boolean
}

type ValidateArgs = {
    validateFunctionIndex?: number,
    compilerArgs?: CompilerArgs
}

type Scenario = {
    file: ts.SourceFile,
    type: (index?: number) => Type,
    validate: (subject: any, args?: ValidateArgs) => Err[],
    typeMap: {key: string, value: Type}[],
    expectSuccess (subject: any, args?: ValidateArgs): void,
    expectFailure (subject: any, args?: ValidateArgs) : void
}

function itShouldNotThrow<T>(f: () => T) {
    try {
        return f();
    } catch (e) {
        it("should not throw exception", () => {
            throw e;
        });
    }
}

export function scenario(validateCode: string, args?: ScenarioArgs): Scenario | undefined {

    return itShouldNotThrow(() => {
        args = args || {};

        const writer = new CodeWriter();

        writer.writeLine("import { validate } from 'ts-validator.validator';");
        writer.writeLine();
        args.validateSetup ? writer.writeLine(args.validateSetup) : null;
        const validateGeneric = args.validateGeneric
            ? `<${args.validateGeneric}>`
            : "";

        writer.writeLine(`validate${validateGeneric}(${validateCode});`);
        
        args.validateTeardown ? writer.writeLine(args.validateTeardown) : null;

        try {
            const file = createFile(writer.toString());
            const result = generateFilesAndTypes(file, "./theTypes", "./theFile");

            if (args.serialize !== false
                && result.typeMap.length === 1 
                && result.typeMap[0].value instanceof AliasedType) {

                const ser = serialize([result.typeMap[0].value]);

                result.typeMap[0].value = deserialize(ser)
                    .getLazy(result.typeMap[0].value.id)();
            }

            const type = (index = 1) => {
                const key = `./theFile?${index}`;
                const map = result.typeMap.filter(x => x.key === key)[0];
                if (!map) {
                    console.error(result.typeMap);
                    throw new Error("Could not find map for " + key);
                }

                return map.value;
            };

            const _validate = function (subject: any, args?: ValidateArgs): Err[] {
                args = args || {};
                return validate(subject, type(args.validateFunctionIndex || 1), args.compilerArgs || {strictNullChecks: true});
            };

            return {
                file,
                type,
                validate: _validate,
                typeMap: result.typeMap,
                expectSuccess: function (subject: any, args?: ValidateArgs) {
                    const errs = _validate(subject, args);
                    if (errs.length !== 0) throw {
                        file: printer.printFile(file),
                        type: type(args && args.validateFunctionIndex || 1),
                        errs
                    };
                },
                expectFailure: function (subject: any, args?: ValidateArgs) {
                    const errs = _validate(subject, args);
                    if (errs.length === 0) throw {
                        msg: "Expected invalid result",
                        file: printer.printFile(file),
                        type: type(args && args.validateFunctionIndex || 1)
                    };
                }
            } as Scenario;
        } catch (e) {
            if (e.message) {
                e.message += "\n\n" + writer.toString();
            } else {
                e.__file = writer.toString();
            }
            throw e;
        }
    });
}

export enum ValidationScenarios {
    direct,
    variable,
    converted,
    explicit,
    typedVariable,
    functionResult,
    resolvedFunction
}

type FullScenarioArgs = {
    valueCode: string,
    validTest: any, 
    invalidTest: any,
    setupCode?: string[],
    teardownCode?: string[],
    typeDefCode?: string,
    shouldValidate?: (x: ValidationScenarios) => boolean,
    shouldInvalidate?: (x: ValidationScenarios) => boolean,
    skipNonTyped?: boolean
}

export class ArrayValidator {
    elements: any[]
    constructor(...elements: any[]) {
        this.elements = elements;
    }
}

const printer: ts.Printer = ts.createPrinter();
export function fullScenario(args: FullScenarioArgs) {
    
    function doValidation(name: ValidationScenarios, scenario: () => Scenario | undefined) {

        const shouldValidate = !args.shouldValidate || args.shouldValidate(name);
        const shouldInvalidate = !args.shouldInvalidate || args.shouldInvalidate(name);
        if (!shouldValidate && !shouldInvalidate) return;
        
        const scn = scenario();
        if (!scn) return;
        
        if (shouldValidate) {
            const validTest = args.validTest instanceof ArrayValidator
                ? args.validTest.elements
                : [args.validTest];

            validTest.forEach(valid => 
                it("should validate correct object", () => {
                    scn.expectSuccess(valid);
                }));
        }
         
        if (shouldInvalidate) {
            const invalidTest = args.invalidTest instanceof ArrayValidator
                ? args.invalidTest.elements
                : [args.invalidTest];

            invalidTest.forEach(invalid =>
                it("should not validate incorrect object", () => {
                    scn.expectFailure(invalid);
                }));
        }
    }
    
    const setup = (args.setupCode && (args.setupCode.join("\n") + "\n\n")) || "";
    const teardown = (args.teardownCode && (args.teardownCode.join("\n") + ";\n\n")) || "";

    function random(max: number) {
        return Math.floor(Math.random() * Math.floor(max + 1));
    }

    function randomScenario<T>(...args: T[]) {
        const r = random(args.length - 1);
        return {
            random: r,
            result: args[r]
        };
    }

    if (!args.skipNonTyped) {
        describe("direct validation, validate(3)", () => {

            const valueCode = randomScenario(
                args.valueCode,
                `(${args.valueCode})`).result;

            doValidation(
                ValidationScenarios.direct, 
                () => scenario(valueCode, {validateSetup: setup, validateTeardown: teardown}));
        });

        describe("validate variable, validate(x)", () => {
            const valueCode = randomScenario(
                `const t = ${args.valueCode};`,
                `const t = (${args.valueCode});`,
                `function f (t = ${args.valueCode}) {`,
                `function f (t = (((${args.valueCode})))) {`,
                `const f = (t = ${args.valueCode}) => {`,
                `const f = (t = (${args.valueCode})) => {`
                ).result;

            doValidation(
                ValidationScenarios.variable, 
                () => scenario("t", { 
                    validateSetup: setup + valueCode, 
                    validateTeardown: (valueCode[valueCode.length - 1] === "{" ? "}" : "") + teardown
                }));
        });
    }
    
    if (args.typeDefCode) {
        describe("validate converted, validate(x as string)", () => {
            const variable = randomScenario(
                `${args.valueCode} as ${args.typeDefCode}`,
                `<${args.typeDefCode}>${args.valueCode}`,
                `(${args.valueCode}) as (${args.typeDefCode})`,
                `<(${args.typeDefCode})>(${args.valueCode})`).result;

            doValidation(
                ValidationScenarios.converted, 
                () => scenario("t", { validateSetup: setup + `const t = ${variable};`, validateTeardown: teardown }));
        });
        
        describe("validate generic in validate function, validate<string>(x)", () => {
            const validateGeneric = randomScenario(
                "(" + args.typeDefCode + ")",
                args.typeDefCode).result;

            doValidation(
                ValidationScenarios.explicit, 
                () => scenario("null as any", {validateSetup: setup, validateTeardown: teardown, validateGeneric}));
        });
        
        describe("validate variable, function or lambda arg, (x: string) => validate(x)", () => {
            const variable = randomScenario(
                `const t: ${args.typeDefCode} = ${args.valueCode};`,
                `const t: (${args.typeDefCode}) = (${args.valueCode});`,
                `function (t: ${args.typeDefCode}) {`,
                `const f = (t: ${args.typeDefCode}) => {`);

            doValidation(
                ValidationScenarios.typedVariable, 
                () => scenario("t", { validateSetup: setup + variable.result, validateTeardown: (variable.random > 1 ? "}" : undefined) + teardown }));
        });
        
        describe("validate function or lambda result, validate(f())", () => {
            
            const variable = randomScenario(
                `function f (): ${args.typeDefCode} { return null as any; }`,
                `function f (): (${args.typeDefCode}) { return null as any; }`,
                `const f = function (): ${args.typeDefCode} { return null as any; }`,
                `const f = (function (): ${args.typeDefCode} { return null as any; })`,
                `const f = function (): (${args.typeDefCode}) { return null as any; }`,
                `const f = (function (): (${args.typeDefCode}) { return null as any; })`,
                `const f = (): ${args.typeDefCode} => { return null as any; }`,
                `const f = (): ${args.typeDefCode} => (null as any)`,
                `const f: () => ${args.typeDefCode} = null as any`,
                `const f: (() => ${args.typeDefCode}) = null as any`
                ).result;

            doValidation(
                ValidationScenarios.functionResult, 
                () => scenario("f()", { validateSetup: setup + variable, validateTeardown: teardown }))
        });

        describe("validate autoresolved function or lambda result, validate((() => 4)())", () => {
            
            const variable = randomScenario(
                `(function f (): ${args.typeDefCode} { return null as any; })()`,
                `(function f (): (${args.typeDefCode}) { return null as any; }())`,
                `((): ${args.typeDefCode} => { return null as any; })()`,
                `((): ${args.typeDefCode} => (null as any))()`).result;

            doValidation(
                ValidationScenarios.resolvedFunction, 
                () => scenario("t", { validateSetup: setup + `const t = ${variable};`, validateTeardown: teardown }));
        });
    }
}