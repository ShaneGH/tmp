import * as chai from 'chai';
import * as ts from 'typescript';
import * as rewriter from '../../src/validation-rewriter/rewrite';

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
            const file = createFile("import { validator } from 'ts-validator';\nvalidator('hello');");
            const result = rewriter.rewrite(file);

            printer.printFile(result.file).should.equal("import { validator } from 'ts-validator';\r\nvalidator('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should rewrite ast for aliased import", () => {
            const file = createFile("import { validator as val } from 'ts-validator';\nval('hello');");
            const result = rewriter.rewrite(file);

            printer.printFile(result.file).should.equal("import { validator as val } from 'ts-validator';\r\nval('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should rewrite ast for namespace import", () => {
            const file = createFile("import * as vvv from 'ts-validator';\nvvv.validator('hello');");
            const result = rewriter.rewrite(file);

            printer.printFile(result.file).should.equal("import * as vvv from 'ts-validator';\r\nvvv.validator('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should not rewrite unrelated functions", () => {
            const file = createFile("import { validator as val } from 'ts-validator';\nvalidator('hello');");
            const result = rewriter.rewrite(file);

            printer.printFile(result.file).should.equal("import { validator as val } from 'ts-validator';\r\nvalidator('hello');\r\n");
        });
            
        it("should preserve existing keys where possible", () => {
            const file = createFile("import { validator as val } from 'ts-validator';\nval('hello', \"testFile.ts?existing key\");");
            const result = rewriter.rewrite(file);

            printer.printFile(result.file).should.equal("import { validator as val } from 'ts-validator';\r\nval('hello', \"testFile.ts?existing key\");\r\n");
        });
            
        it("should rewrite existing keys if prefix is invalid", () => {
            const file = createFile("import { validator as val } from 'ts-validator';\nval('hello', \"existing key\");");
            const result = rewriter.rewrite(file);

            printer.printFile(result.file).should.equal("import { validator as val } from 'ts-validator';\r\nval('hello', \"testFile.ts?1\");\r\n");
        });
            
        it("should generate unique key values for different calls", () => {
            const file = createFile("import { validator as val } from 'ts-validator';\nval('hello');\nval('hello');");
            const result = rewriter.rewrite(file);

            printer.printFile(result.file).should.equal("import { validator as val } from 'ts-validator';\r\nval('hello', \"testFile.ts?1\");\r\nval('hello', \"testFile.ts?2\");\r\n");
        });
    });

    // describe("compile type tests", function () {
            
    //     it("should record string literal type", () => {
    //         const file = createFile("import { validator } from 'ts-validator';\nvalidator<string>('hello');");
    //         const result = rewriter.rewrite(file);

    //         printer.printFile(result.file).should.equal("import { validator } from 'ts-validator';\r\nvalidator('hello', \"testFile.ts?1\");\r\n");
    //     });
    // });

    // describe("generic test", function () {
            
    //     const file = createFile("import * as validator from 'ts-validator';\nfunction val<T>(input: T) { validator(input); }");

    //     it("should throw error with good error message", () => {
    //         rewriter.rewrite(file);
    //     });
    // });
});
