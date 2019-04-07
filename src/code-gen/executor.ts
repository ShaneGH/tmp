import { generateValidateFile } from './clientSideValidator'
import { rewrite } from '../validation-rewriter/rewrite'
import * as ts from 'typescript'
import _ = require('lodash');
import { moduleName } from '../const';

const tsValidatorFile = moduleName + "-types.ts";
const printer: ts.Printer = ts.createPrinter();

// TODO: error handling
type ExecuteDependencies = {
    readFile: (fileName: string) => Promise<string>
    writeFile: (fileName: string, fileContent: string) => Promise<any>
    findClosestProjectDirectory: (fileName: string) => Promise<string>
    parsePath: (...parts: string[]) => string
    convertToRelativePath: (pathFrom: string, pathTo: string) => string
    convertRelativePathToUnix: (path: string) => string
}

const execute = (fileName: string) => async (dependencies: ExecuteDependencies) => {
    const file = ts.createSourceFile(
        fileName, 
        await dependencies.readFile(fileName),
        ts.ScriptTarget.ES2015);

    const proj = await dependencies.findClosestProjectDirectory(fileName);
    const typesFile = dependencies
        .convertRelativePathToUnix(
            dependencies.convertToRelativePath(
                fileName,
                dependencies.parsePath(proj, tsValidatorFile)))
        .replace(/\.[jt]s$/, "");

    const fileRelativePath = dependencies
        .convertRelativePathToUnix(
            dependencies.convertToRelativePath(
                proj,
                fileName));

    const rewritten = rewrite(file, typesFile, fileRelativePath);
    await dependencies.writeFile(
        rewritten.file.fileName,
        printer.printFile(rewritten.file));

    const validateFile = generateValidateFile(rewritten.typeKeys, {strictNullChecks: true});
    const location = dependencies.parsePath(proj, tsValidatorFile);
        
    await dependencies.writeFile(
        location,
        validateFile.toString());
}

export {
    execute
}