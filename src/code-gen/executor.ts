import { generateValidateFile } from './clientSideValidator'
import { rewrite } from '../validation-rewriter/rewrite'
import * as ts from 'typescript'
import _ = require('lodash');
import { moduleName } from '../const';

const tsValidatorFile = moduleName + "-types.ts";
const printer: ts.Printer = ts.createPrinter();

type ExecuteDependencies = {
    readFile: (fileName: string) => Promise<string>
    writeFile: (fileName: string, fileContent: string) => Promise<any>
    findClosestProjectDirectory: (fileName: string) => Promise<string>
    joinPath: (...parts: string[]) => string
    convertToRelativePath: (pathFrom: string, pathTo: string) => string
    convertRelativePathToUnix: (path: string) => string
}

const execute = (fileName: string) => async (dependencies: ExecuteDependencies) => {
    const file = ts.createSourceFile(
        fileName, 
        await dependencies.readFile(fileName),
        ts.ScriptTarget.ES2015,
        true,
        ts.ScriptKind.TS);

    const proj = await dependencies.findClosestProjectDirectory(fileName);
    const typesFile = dependencies
        .convertRelativePathToUnix(
            dependencies.convertToRelativePath(
                fileName,
                dependencies.joinPath(proj, tsValidatorFile)))
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
    const location = dependencies.joinPath(proj, tsValidatorFile);
        
    await dependencies.writeFile(
        location,
        validateFile.toString());
}

export {
    execute
}