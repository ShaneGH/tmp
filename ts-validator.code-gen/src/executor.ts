import { transform } from './fileTransformer'
import * as ts from 'typescript'
import * as _ from 'lodash';
import { validatorModuleName } from './const';
import { AliasedType, LazyDictionary, LazyTypeReference } from 'ts-validator.core';
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
    function convertTypeOrThrow(type: ts.TypeNode) {
        const r = convertType(type, file, fileRelativePath);
        if (!r) {
            throw new Error(`Cannot resolve type for : ${type.getText(file)}`);
        }

        if (r instanceof AliasedType) {
            return new LazyTypeReference(r.id, () => r);
        }

        return r;
    }

    return function (expr: TypeExpression) {
        if (expr instanceof UnknownExpression) {
            return resolveObject(expr, file)(convertTypeOrThrow);
        }

        if (ts.isObjectLiteralExpression(expr) || ts.isArrayLiteralExpression(expr)) {
            return resolveObject(expr, file)(convertTypeOrThrow);
        }

        const result = convertType(expr, file, fileRelativePath, state);
        if (!result) {
            throw new Error(`Cannot find type for variable: ${expr.getText(file)}`);
        }

        return result;
    }
}

export function generateFilesAndTypes (file: ts.SourceFile, typesFileName: string, fileRelativePath: string) {

    const transformed = transform(file, typesFileName, fileRelativePath);

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
            ts.isTypeNode(tk.value)
                ? tk.value
                : resolveTypeForExpression(tk.value, transformed.file))
    }));

    const validateFile = generateValidateFile(typeMap, {strictNullChecks: true});

    return {
        transformedFile: transformed.file,
        typeMap,
        validateFile
    };
}

export const execute = (fileName: string) => async (dependencies: ExecuteDependencies) => {
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

    const filesAndTypes = generateFilesAndTypes(file, typesFile, fileRelativePath);
    const location = dependencies.joinPath(proj, tsValidatorFile);

    await dependencies.writeFile(
        filesAndTypes.transformedFile.fileName,
        printer.printFile(filesAndTypes.transformedFile));
        
    await dependencies.writeFile(
        location,
        filesAndTypes.validateFile.toString());
}