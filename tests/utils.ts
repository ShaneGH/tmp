import * as ts from 'typescript';
import { validate } from '../ts-validator.validator/src/validate';
import { generateFilesAndTypes } from '../ts-validator.code-gen/src/executor';
import { CodeWriter } from '../ts-validator.code-gen/src/clientSideValidator';
import { CompilerArgs, serialize } from 'ts-validator.core';

function createFile(text: string) {
    return ts.createSourceFile(
        'testFile.ts', text, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
    );
}

type ScenarioArgs = {
    validateSetup?: string
    validateGeneric?: string
}

export function scenario(validateCode: string, args?: ScenarioArgs) {
    args = args || {};

    const writer = new CodeWriter();

    writer.writeLine("import { validate } from 'ts-validator.validator';");
    writer.writeLine();
    args.validateSetup ? writer.writeLine(args.validateSetup) : null;
    const validateGeneric = args.validateGeneric
        ? `<${args.validateGeneric}>`
        : "";

    writer.writeLine(`validate${validateGeneric}(${validateCode});`);

    const file = createFile(writer.toString());

    const result = generateFilesAndTypes(file, "./theTypes", "./theFile");

    type ValidateArgs = {
        validateFunctionIndex?: number,
        compilerArgs?: CompilerArgs
    }

    function type (index = 1) {
        const key = `./theFile?${index}`;
        const map = result.typeMap.filter(x => x.key === key)[0];
        if (!map) {
            console.error(result.typeMap);
            throw new Error("Could not find map for " + key);
        }

        return map.value;
    }

    return {
        file,
        typeMap: result.typeMap,
        type,
        validate: function (subject: any, args?: ValidateArgs) {
            args = args || {};
            return validate(subject, type(args.validateFunctionIndex || 1), args.compilerArgs || {strictNullChecks: true});
        }
    }
}