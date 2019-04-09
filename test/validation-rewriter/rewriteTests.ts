import * as chai from 'chai';
import * as ts from 'typescript';
import * as rewriter from '../../src/validation-rewriter/rewrite';

chai.should();

describe("rewriter", function () {
    
    function assertNotNull<T>(x: T | null): x is T {
        if (x === undefined) x = null;
        chai.assert.isNotNull(x);

        return true;
    }

    function createFile(text: string) {
        return ts.createSourceFile(
            'testFile.ts', text, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
        );
    }
    
    const printer: ts.Printer = ts.createPrinter();

    describe("rewrite tests", function () {
            
        it("should rewrite ast for named import", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate('hello');");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvalidate('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should rewrite ast for aliased import", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello');");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should rewrite ast for namespace import", () => {
            const file = createFile("import * as vvv from 'ts-validator';\nvvv.validate('hello');");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport * as vvv from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvvv.validate('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should retain type signature", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate<string>('hello');");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvalidate<string>('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should not rewrite unrelated functions", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nvalidate('hello');");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nvalidate('hello');\r\n");
        });
            
        it("should preserve existing keys where possible", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello', \"testFile.ts?existing key\");");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?existing key\");\r\n");
        });
            
        it("should rewrite existing keys if prefix is invalid", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello', \"existing key\");");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should generate unique key values for different calls", () => {
            const file = createFile("import { validate as val } from 'ts-validator';\nval('hello');\nval('hello');");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { init as __initTsValidatorTypes } from \"tyLoc\";\r\nimport { validate as val } from 'ts-validator';\r\n__initTsValidatorTypes();\r\nval('hello', \"testFile.ts?1\");\r\nval('hello', \"testFile.ts?2\");\r\n");
        });
            
        it("should not import init call twice", () => {
            const file = createFile("import { validate } from 'ts-validator';\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\nvalidate('hello');");
            const result = rewriter.rewrite(file, "existingLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { validate } from 'ts-validator';\r\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\r\n__initTsValidatorTypes();\r\nvalidate('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should not call init call twice", () => {
            const file = createFile("import { validate } from 'ts-validator';\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\n__initTsValidatorTypes();\nvalidate('hello');");
            const result = rewriter.rewrite(file, "existingLoc", "testFile.ts");

            printer.printFile(result.file).should.equal("import { validate } from 'ts-validator';\r\nimport { init as __initTsValidatorTypes } from \"existingLoc\";\r\n__initTsValidatorTypes();\r\nvalidate('hello', \"testFile.ts?1\");\r\n");
        });
    });

    describe("record call node tests", function () {
            
        it("should record call node argument", () => {
            const file = createFile("import { validate } from 'ts-validator';\nvalidate('hello');");
            const result = rewriter.rewrite(file, "tyLoc", "testFile.ts");

            const callNode = result.typeKeys[0].value;
            if (!ts.isStringLiteral(callNode)) {
                false.should.be.eq(true, `Should be call expression ${ts.SyntaxKind[callNode.kind]}`);
                return;
            }

            callNode.text.should.be.eq("hello");
        });
    });
});
