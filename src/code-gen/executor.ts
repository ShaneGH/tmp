import { generateValidateFile } from './clientSideValidator'
import { rewrite } from '../validation-rewriter/rewrite'
import * as ts from 'typescript'
import * as fs from 'fs';
import _ = require('lodash');

const printer: ts.Printer = ts.createPrinter();

function execute (fileName: string) {
    const file = ts.createSourceFile(
        fileName, 
        fs.readFileSync(fileName).toString(), 
        ts.ScriptTarget.ES2015);

    const rewritten = rewrite(file);
    fs.writeFileSync(
        rewritten.file.fileName,
        printer.printFile(rewritten.file));

    const validateFile = generateValidateFile(rewritten.typeKeys, {strictNullChecks: true});
    fs.writeFileSync(
        "C:\\Dev\\ts-validator-dummy\\src\\blabla.ts",
        validateFile.toString());
}

const fileName = process.argv[2];
if (!fileName) {
    throw new Error("You must specify a file name");
}

execute(fileName);