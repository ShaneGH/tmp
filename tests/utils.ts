import * as ts from 'typescript';
import * as chai from 'chai';
import { validate as validate, Err } from '../ts-validator.validator/src/validate';
import { generateFilesAndTypes } from '../ts-validator.code-gen/src/executor';
import { CodeWriter } from '../ts-validator.code-gen/src/clientSideValidator';
import { CompilerArgs, serialize, Type } from 'ts-validator.core';

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
}

type ValidateArgs = {
    validateFunctionIndex?: number,
    compilerArgs?: CompilerArgs
}

type Scenario = {
    file: ts.SourceFile,
    validate: (subject: any, args?: ValidateArgs) => Err[],
    typeMap: {key: string, value: Type}[],
    type: (index?: number) => Type,
    expectSuccess (subject: any, args?: ValidateArgs): void,
    expectFailure (subject: any, args?: ValidateArgs) : void
}

export function scenario(validateCode: string, args?: ScenarioArgs): Scenario {
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

    const file = createFile(writer.toString());

    try {

        const result = generateFilesAndTypes(file, "./theTypes", "./theFile");

        const type = (index = 1) => {
            const key = `./theFile?${index}`;
            const map = result.typeMap.filter(x => x.key === key)[0];
            if (!map) {
                console.error(result.typeMap);
                throw new Error("Could not find map for " + key);
            }

            return map.value;
        };

        const _validate = function (subject: any, args?: ValidateArgs) {
            args = args || {};
            return validate(subject, type(args.validateFunctionIndex || 1), args.compilerArgs || {strictNullChecks: true});
        };

        return {
            file,
            typeMap: result.typeMap,
            type,
            validate: _validate,
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
        }
    } catch (e) {
        console.error("Error executing code:");
        console.error(writer.toString());
        throw e;
    }
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
    
    function doValidation(name: ValidationScenarios, result: Scenario) {
        
        if (!args.shouldValidate || args.shouldValidate(name)) {
            const validTest = args.validTest instanceof ArrayValidator
                ? args.validTest.elements
                : [args.validTest];

            validTest.forEach(valid => 
                it("should validate correct object", () => {
                    result.expectSuccess(valid);
                }));
        }
         
        if (!args.shouldInvalidate || args.shouldInvalidate(name)) {
            const invalidTest = args.invalidTest instanceof ArrayValidator
                ? args.invalidTest.elements
                : [args.invalidTest];

            invalidTest.forEach(invalid =>
                it("should not validate incorrect object", () => {
                    result.expectFailure(invalid);
                }));
        }
    }
    
    const setup = (args.setupCode && (args.setupCode.join("\n") + ";\n\n")) || "";

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

            const result = scenario(valueCode, {validateSetup: setup});
            doValidation(ValidationScenarios.direct, result);
        });

        describe("validate variable, validate(x)", () => {
            const valueCode = randomScenario(
                `const t = ${args.valueCode};`,
                `const t = (${args.valueCode});`,
                `function f (t = ${args.valueCode}) {`,
                `function f (t = (((${args.valueCode})))) {`,
                `const f = (t = ${args.valueCode}) => {`,
                `const f = (t = (${args.valueCode})) => {`);

            const result = scenario("t", { 
                validateSetup: setup + valueCode.result, 
                validateTeardown: valueCode.random > 1 ? "}" : ""
            });

            doValidation(ValidationScenarios.variable, result);
        });
    }
    
    if (args.typeDefCode) {
        describe("validate converted, validate(x as string)", () => {
            const variable = randomScenario(
                `${args.valueCode} as ${args.typeDefCode}`,
                `<${args.typeDefCode}>${args.valueCode}`,
                `(${args.valueCode}) as (${args.typeDefCode})`,
                `<(${args.typeDefCode})>(${args.valueCode})`).result;

            const result = scenario("t", { validateSetup: setup + `const t = ${variable};` });
            
            doValidation(ValidationScenarios.converted, result);
        });
        
        describe("validate generic in validate function, validate<string>(x)", () => {
            const validateGeneric = randomScenario(
                "(" + args.typeDefCode + ")",
                args.typeDefCode).result;

            const result = scenario("null as any", {validateSetup: setup, validateGeneric});
            doValidation(ValidationScenarios.explicit, result);
        });
        
        describe("validate variable, function or lambda arg, (x: string) => validate(x)", () => {
            const variable = randomScenario(
                `const t: ${args.typeDefCode} = ${args.valueCode};`,
                `const t: (${args.typeDefCode}) = (${args.valueCode});`,
                `function (t: ${args.typeDefCode}) {`,
                `const f = (t: ${args.typeDefCode}) => {`);

            const result = scenario("t", { validateSetup: setup + variable.result, validateTeardown: variable.random > 0 ? "}" : undefined });
            
            doValidation(ValidationScenarios.typedVariable, result);
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

            const result = scenario("f()", { validateSetup: setup + variable });
            
            doValidation(ValidationScenarios.functionResult, result);
        });

        describe("validate autoresolved function or lambda result, validate((() => 4)())", () => {
            
            const variable = randomScenario(
                `(function f (): ${args.typeDefCode} { return null as any; })()`,
                `(function f (): (${args.typeDefCode}) { return null as any; }())`,
                `((): ${args.typeDefCode} => { return null as any; })()`,
                `((): ${args.typeDefCode} => (null as any))()`).result;

            const result = scenario("t", { validateSetup: setup + `const t = ${variable};` });
            
            doValidation(ValidationScenarios.resolvedFunction, result);
        });
    }
}