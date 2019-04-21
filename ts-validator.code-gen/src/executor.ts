import { transform } from './fileTransformer'
import * as ts from 'typescript'
import * as _ from 'lodash';
import { validatorModuleName } from './const';
import { AliasedType, LazyDictionary, PropertyKeyword, LazyTypeReference } from 'ts-validator.core';
import { convertType } from './typeConvertor';
import { resolveObject } from './objectConvertor';
import { resolveTypeForExpression, TypeExpression, UnknownExpression } from './expressionTypeResolver';
import { generateValidateFile } from './clientSideValidator';

const tsValidatorFile = validatorModuleName + "-types.ts";
const printer: ts.Printer = ts.createPrinter();

type ExecuteDependencies = {
    readFile: (fileName: string) => Promise<string>
    writeFile: (fileName: string, fileContent: string) => Promise<any>
    findClosestProjectDirectory: (fileName: string) => Promise<string>
    joinPath: (...parts: string[]) => string
    convertToRelativePath: (pathFrom: string, pathTo: string) => string
    convertRelativePathToUnix: (path: string) => string
}

function crateType(state: LazyDictionary<AliasedType>, file: ts.SourceFile, fileRelativePath: string) {
    return function (expr: TypeExpression) {
        if (expr instanceof UnknownExpression) {
            return resolveObject(expr, file);
        }

        if (ts.isObjectLiteralExpression(expr) || ts.isArrayLiteralExpression(expr)) {
            return resolveObject(expr, file);
        }

        const result = convertType(expr, file, fileRelativePath, state);
        if (!result) {
            throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
        }

        return result;
    }
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

    const transformed = transform(file, typesFile, fileRelativePath);
    await dependencies.writeFile(
        transformed.file.fileName,
        printer.printFile(transformed.file));

    const f = crateType(new LazyDictionary<AliasedType>(), transformed.file, fileRelativePath);
    function crtyp(expr: TypeExpression) {
        const result = f(expr);
        if (result instanceof LazyTypeReference) {
            return result.getType();
        }

        return result;
    }

    const typeMap = transformed.typeKeys.map(tk => ({
        key: tk.key,
        value: crtyp(
            resolveTypeForExpression(tk.value, transformed.file))
    }));

    const validateFile = generateValidateFile(typeMap, {strictNullChecks: true});
    const location = dependencies.joinPath(proj, tsValidatorFile);
        
    await dependencies.writeFile(
        location,
        validateFile.toString());
}

export {
    execute
}