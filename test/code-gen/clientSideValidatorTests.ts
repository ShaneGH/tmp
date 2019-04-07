import * as chai from 'chai';
import { generateValidateFile } from "../../src/code-gen/clientSideValidator";
import * as ts from 'typescript';
import { rewrite } from "../../src/validation-rewriter/rewrite";

chai.should();

function createFile(text: string) {
    return ts.createSourceFile(
        'testFile.ts', text, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
    );
}

const rewriteOutput = rewrite(createFile(`
import { validator } from 'ts-validator';

interface MyI {
    val: string
}

interface MyI2 extends MyI {
    num: number
}

let c: MyI2 = {val: "hi", num: 7};
validator(c);
`), "typeVal.ts");

describe("Client side validator smoke test", () => {
    it("should not throw", () => {
        generateValidateFile(rewriteOutput.typeKeys, {strictNullChecks: true}).toString().should.not.eq("");
    });
});