import * as chai from 'chai';
import * as ts from 'typescript';
import { transform } from '../../ts-validator.code-gen/src/fileTransformer';
import { PropertyKeyword } from 'ts-validator.core';
import { resolveTypeForExpression, ObjectCreation } from '../../ts-validator.code-gen/src/expressionTypeResolver';

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
        const file = createFile(`import { validate } from 'ts-validator.validator';\nvalidate(${codeToValidate});`);
        return {
            file,
            arg: transform(file, "tyLoc", "testFile.ts").typeKeys[0].value
        };
    }

    describe("compile variable type tests", function () {
            
        function execute (type: string, value: string, 
            explicit: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node>) => void, 
            implicit: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node>) => void, 
            direct?: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node>) => void) {
            it("explicit", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
let x: ${type} = ${value};
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
                explicit(result);
            });
            
            it("implicit", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
let x = ${value};
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
                implicit(result);
            });
            
            it("direct", () => {
                const ref = getTypeReference(value);
                const result = resolveTypeForExpression<ts.TypeNode>(ref.arg, ref.file)(x => x);
                (direct || implicit)(result);
            });
        }

        describe("for a string", () => {
            execute("string", "'hi'",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => x.should.be.eq(PropertyKeyword.string));
        });
        
        describe("for a number", () => {
            execute("number", "7",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => x.should.be.eq(PropertyKeyword.number));
        });
        
        describe("for true", () => {
            execute("boolean", "true",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.BooleanKeyword),
                x => x.should.be.eq(PropertyKeyword.boolean));
        });
        
        describe("for false", () => {
            execute("boolean", "false",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.BooleanKeyword),
                x => x.should.be.eq(PropertyKeyword.boolean));
        });
        
        describe("for null", () => {
            execute("null", "null",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NullKeyword),
                x => x.should.be.eq(PropertyKeyword.null));
        });
        
        describe("for undefined", () => {
            execute("undefined", "undefined",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.UndefinedKeyword),
                x => x.should.be.eq(PropertyKeyword.undefined));
        });
        
        describe("for literal as", () =>
            execute("string", "null as string",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword)));
        
        describe("for literal cast", () =>
            execute("string", "<string>null",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword)));
        
        describe("for empty object", () =>
            execute("object", "{}",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ObjectKeyword),
                x => {
                    x.should.be.instanceOf(ObjectCreation);
                    (x as ObjectCreation<ts.Node>).values.length.should.eq(0);
                }));
                
        describe("for complex object", () =>
            execute("object", '{x: 5, "y": {4: true}}',
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ObjectKeyword),
                x => {
                    let outer = x as ObjectCreation<ts.Node>;
                    outer.should.be.instanceOf(ObjectCreation);

                    outer.values.length.should.eq(2);
                    outer.values[0].name.should.eq("x", "name");
                    outer.values[0].value.should.eq(PropertyKeyword.number);
                    
                    outer.values[1].name.should.eq("y", "name");
                    let inner = outer.values[1].value as ObjectCreation<ts.Node>;
                    inner.should.be.instanceOf(ObjectCreation);
                    
                    inner.values.length.should.eq(1);
                    inner.values[0].name.should.eq("4", "name");
                    inner.values[0].value.should.eq(PropertyKeyword.boolean);
                }));

    /* // https://github.com/ShaneGH/ts-validator/issues/7
validate([])
validate(new Date())
validate(/sdsd/)
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
