import { transform } from './fileTransformer'
import * as ts from 'typescript'
import * as _ from 'lodash';
import { validatorModuleName } from './const';
import { AliasedType, LazyDictionary, Type, Properties, Property, LazyTypeReference } from 'ts-validator.core';
import { convertType } from './typeConvertor';
import { resolveTypeForExpression, ObjectCreation, ObjectCreationProperty } from './expressionTypeResolver';
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

function rewrapObjectCreationProperty(property: ObjectCreationProperty<Type>): Property {
    const value = rewrapObjectCreation(property.value);
    return new Property(
        property.name,
        value instanceof AliasedType 
            ? new LazyTypeReference(value.id, () => value) 
            : value);
}

function rewrapObjectCreation(values: Type | ObjectCreation<Type>): Type {
    if (!(values instanceof ObjectCreation)) {
        return values;
    }

    return new Properties(values.values.map(rewrapObjectCreationProperty));
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

    const state = new LazyDictionary<AliasedType>();
    const typeMap = transformed.typeKeys.map(tk => ({
        key: tk.key,
        value: rewrapObjectCreation(
            resolveTypeForExpression<Type>(tk.value, transformed.file)(x => convertType(x, transformed.file, fileRelativePath, state)))
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