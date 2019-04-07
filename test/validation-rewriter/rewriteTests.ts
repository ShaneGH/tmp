import * as chai from 'chai';
import * as ts from 'typescript';
import * as rewriter from '../../src/validation-rewriter/rewrite';
import { PropertyKeyword } from '../../src/validation-rewriter/types';

chai.should();

describe("rewriter", function () {

    function createFile(text: string) {
        return ts.createSourceFile(
            'testFile.ts', text, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
        );
    }
    
    const printer: ts.Printer = ts.createPrinter();

    describe("rewrite tests", function () {
            
        it("should rewrite ast for named import", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate('hello');");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvalidate('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should rewrite ast for aliased import", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello');");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should rewrite ast for namespace import", () => {
            const file = createFile("import * as vvv from 'ts-validator';\nvvv.validate('hello');");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport * as vvv from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvvv.validate('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should retain type signature", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate<string>('hello');");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvalidate<string>('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should not rewrite unrelated functions", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nvalidate('hello');");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvalidate('hello');\r\n");
        });
            
        it("should preserve existing keys where possible", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello', \"testFile.ts?existing key\");");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?existing key\");\r\n");
        });
            
        it("should rewrite existing keys if prefix is invalid", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello', \"existing key\");");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should generate unique key values for different calls", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello');\nval('hello');");
            const result = rewriter.rewrite(file, "tyLoc");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?1\");\r\nval('hello', \"testFile.ts?2\");\r\n");
        });
            
        it("should not import init call twice", () => {
            const file = createFile("import { validate } from 'ts-validator';\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\nvalidate('hello');");
            const result = rewriter.rewrite(file, "existingLoc");

            printer.printFile(result.file).should.equal("import { validate } from 'ts-validator';\r\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\r\n__initTsValidatorTypes();\r\nvalidate('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should not call init call twice", () => {
            const file = createFile("import { validate } from 'ts-validator';\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\n__initTsValidatorTypes();\nvalidate('hello');");
            const result = rewriter.rewrite(file, "existingLoc");

            printer.printFile(result.file).should.equal("import { validate } from 'ts-validator';\r\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\r\n__initTsValidatorTypes();\r\nvalidate('hello', \"testFile.ts?1\");\r\n");
        });
    });

    describe("compile type literal and keyword tests", function () {
            
        it("should record string literal type", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate('hello');");
            const result = rewriter.rewrite(file, "tyLoc");

            result.typeKeys["testFile.ts?1"].name.should.equal("string");
            result.typeKeys["testFile.ts?1"].extends[0].should.equal(PropertyKeyword.string);
        });
            
        it("should record number type", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate(10);");
            const result = rewriter.rewrite(file, "tyLoc");

            result.typeKeys["testFile.ts?1"].name.should.equal("number");
            result.typeKeys["testFile.ts?1"].extends[0].should.equal(PropertyKeyword.number);
        });
            
        it("should record true type", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate(true);");
            const result = rewriter.rewrite(file, "tyLoc");

            result.typeKeys["testFile.ts?1"].name.should.equal("boolean");
            result.typeKeys["testFile.ts?1"].extends[0].should.equal(PropertyKeyword.boolean);
        });
            
        it("should record false type", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate(false);");
            const result = rewriter.rewrite(file, "tyLoc");

            result.typeKeys["testFile.ts?1"].name.should.equal("boolean");
            result.typeKeys["testFile.ts?1"].extends[0].should.equal(PropertyKeyword.boolean);
        });
            
        it("should record null type", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate(null);");
            const result = rewriter.rewrite(file, "tyLoc");

            result.typeKeys["testFile.ts?1"].name.should.equal("null");
            result.typeKeys["testFile.ts?1"].extends[0].should.equal(PropertyKeyword.null);
        });
            
        it("should record undefined type", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate(undefined);");
            const result = rewriter.rewrite(file, "tyLoc");

            result.typeKeys["testFile.ts?1"].name.should.equal("undefined");
            result.typeKeys["testFile.ts?1"].extends[0].should.equal(PropertyKeyword.undefined);
        });
    });

    describe("compile variable type tests", function () {
            
        it("should compile type when type is built in", () => {
            const file = createFile(`import { validate } from 'ts-validator';
let x: string = "hi";
validate(x);`);
            const result = rewriter.rewrite(file, "tyLoc");

            result.typeKeys["testFile.ts?1"].name.should.equal("string");
            result.typeKeys["testFile.ts?1"].extends[0].should.equal(PropertyKeyword.string);
        });

    /* // https://github.com/ShaneGH/ts-validator/issues/7
validate(someValue)
validate({})
validate({} as string)
validate([])
validate(new Date())
validate(/sdsd/)
validate(<string>{}) cast
validate(<SomeTsxTag></SomeTsxTag>)

     */

    // describe("generic test", function () {
            
    //     const file = createFile("import * as validator from 'ts-validator';\nfunction val<T>(input: T) { validate(input); }");

    //     it("should throw error with good error message", () => {
    //         rewriter.rewrite(file, "tyLoc");
    //     });
    // });
    });
});
