import { generateValidateFile } from './clientSideValidator'
import { rewrite } from '../validation-rewriter/rewrite'
import * as ts from 'typescript'
import _ = require('lodash');

const tsValidatorFile = "ts-validator-def.ts"
const printer: ts.Printer = ts.createPrinter();

// TODO: error handling
type ExecuteDependencies = {
    readFile: (fileName: string) => Promise<string>
    writeFile: (fileName: string, fileContent: string) => Promise<any>
    findClosestProjectDirectory: (fileName: string) => Promise<string>
    parsePath: (...parts: string[]) => string
}

const execute = (fileName: string) => async (dependencies: ExecuteDependencies) => {
    const file = ts.createSourceFile(
        fileName, 
        await dependencies.readFile(fileName),
        ts.ScriptTarget.ES2015);

    const rewritten = rewrite(file);
    await dependencies.writeFile(
        rewritten.file.fileName,
        printer.printFile(rewritten.file));

    const validateFile = generateValidateFile(rewritten.typeKeys, {strictNullChecks: true});
    const location = dependencies.parsePath(
        await dependencies.findClosestProjectDirectory(fileName),
        "node_modules",
        "ts-validator",
        tsValidatorFile);
        
    await dependencies.writeFile(
        location,
        validateFile.toString());
}

export {
    execute
}