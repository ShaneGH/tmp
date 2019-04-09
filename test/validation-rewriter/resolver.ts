import * as chai from 'chai';
import * as ts from 'typescript';
import * as rewriter from '../../src/validation-rewriter/rewrite';
import { PropertyKeyword, AliasedType } from '../../src/validation-rewriter/types';
import { resolveTypeForExpression } from '../../src/validation-rewriter/resolver';

chai.should();

describe("resolver", function () {
    
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

    function getTypeReference(codeToValidate: string) {
        const file = createFile(`import { validate } from 'ts-validator';\nvalidate(${codeToValidate});`);
        return {
            file,
            arg: rewriter.rewrite(file, "tyLoc", "testFile.ts").typeKeys[0].value
        };
    }
    
    const printer: ts.Printer = ts.createPrinter();
    describe("resolveTypeForExpression", function () {

        function execute(typeValue: string, keyword: PropertyKeyword) {
            const ref = getTypeReference(typeValue);
            const result = resolveTypeForExpression<ts.TypeNode>(ref.arg, ref.file)(x => x);

            result.should.equal(keyword);
        }
            
        it("should find string literal type", () => {
            execute("'hello'", PropertyKeyword.string);
        });
            
        it("should find number literal type", () => {
            execute("4", PropertyKeyword.number);
        });
            
        it("should find true literal type", () => {
            execute("true", PropertyKeyword.boolean);
        });
            
        it("should find true literal type", () => {
            execute("false", PropertyKeyword.boolean);
        });
            
        it("should find null literal type", () => {
            execute("null", PropertyKeyword.null);
        });
            
        it("should find undefined literal type", () => {
            execute("undefined", PropertyKeyword.undefined);
        });
    });

    describe("compile variable type tests", function () {
            
        it("should compile type when type is built in", () => {
            const file = createFile(`import { validate } from 'ts-validator';
let x: string = "hi";
validate(x);`);
            const arg = rewriter.rewrite(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);

            (result as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword);
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
