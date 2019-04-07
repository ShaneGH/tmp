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

const testCases = [`
import { validator } from 'ts-validator';

interface MyI {
    val: string
}

interface MyI2 extends MyI {
    num: number
}

let c: MyI2 = {val: "hi", num: 7};
validator(c);
`, `
import { init as __initTsValidatorTypes } from "../ts-validator-types";
import { validate } from "ts-validator";
__initTsValidatorTypes();
//validate("hello", "./src/my.ts?1");


type MyT = {
    val: string
};

let yy: MyT = {} as any;

validate(yy);
`]
.map(x => rewrite(createFile(x), "typeVal.ts", "./anotherVal.ts"));

describe("Client side validator smoke tests", () =>
    testCases.forEach((val, i) => it("should not throw " + i, () =>
        generateValidateFile(testCases[i].typeKeys, {strictNullChecks: true}).toString().should.not.eq(""))));