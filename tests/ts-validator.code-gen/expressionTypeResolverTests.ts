import * as chai from 'chai';
import * as ts from 'typescript';
import { transform } from '../../ts-validator.code-gen/src/fileTransformer';
import { PropertyKeyword } from 'ts-validator.core';
import { resolveTypeForExpression, UnknownExpression } from '../../ts-validator.code-gen/src/expressionTypeResolver';

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

    function getTypeReference(setup: string, codeToValidate: string) {
        const file = createFile(`import { validate } from 'ts-validator.validator';\n${setup}\nvalidate(${codeToValidate});`);
        return {
            file,
            arg: transform(file, "tyLoc", "testFile.ts").typeKeys[0].value
        };
    }

    describe("compile variable type tests", function () {
            
        function execute (type: string, value: string, 
            explicit: <T extends ts.Node | UnknownExpression>(x: T) => void, 
            implicit: <T extends ts.Node | UnknownExpression>(x: T) => void, 
            direct?: <T extends ts.Node | UnknownExpression>(x: T) => void) {

            return executeWithSetup("", type, value, explicit, implicit, direct);
        }
            
        function executeWithSetup (setup: string, type: string, value: string, 
            explicit: <T extends ts.Node | UnknownExpression>(x: T) => void, 
            implicit: <T extends ts.Node | UnknownExpression>(x: T) => void, 
            direct?: <T extends ts.Node | UnknownExpression>(x: T) => void) {
            it("explicit", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
${setup}
let x: ${type} = ${value};
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression(arg, file);
                explicit(result);
            });
            
            it("as", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
${setup}
let x = (null as unknown) as ${type};
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression(arg, file);
                explicit(result);
            });
            
            it("cast", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
${setup}
let x = <${type}>(null as unknown);
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression(arg, file);
                explicit(result);
            });
            
            it("implicit", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
${setup}
const x = ${value};
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression(arg, file);
                implicit(result);
            });
            
            it("direct", () => {
                const ref = getTypeReference(setup, value);
                const result = resolveTypeForExpression(ref.arg, ref.file);
                (direct || implicit)(result);
            });
        }

        describe("for a string", () => {
            execute("string", "'hi'",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => x.kind.should.be.eq(ts.SyntaxKind.StringLiteral));
        });
        
        describe("for a number", () => {
            execute("number", "7",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => x.kind.should.be.eq(ts.SyntaxKind.NumericLiteral));
        });
        
        describe("for true", () => {
            execute("boolean", "true",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.BooleanKeyword),
                x => x.kind.should.be.eq(ts.SyntaxKind.TrueKeyword));
        });
        
        describe("for false", () => {
            execute("boolean", "false",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.BooleanKeyword),
                x => x.kind.should.be.eq(ts.SyntaxKind.FalseKeyword));
        });
        
        describe("for null", () => {
            execute("null", "null",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NullKeyword),
                x => x.kind.should.be.eq(ts.SyntaxKind.NullKeyword));
        });
        
        describe("for undefined", () => {
            execute("undefined", "undefined",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.UndefinedKeyword),
                x => x.kind.should.be.eq(ts.SyntaxKind.UndefinedKeyword));
        });
        
        describe("for literal as", () =>
            execute("string", "null as string",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword)));
        
        describe("for literal cast", () =>
            execute("string", "<string>null",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword)));

        describe("for a parentiesized type", () =>
            execute("(string)", "'hi'",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => x.kind.should.be.eq(ts.SyntaxKind.StringLiteral)));
        
        describe("for empty object", () =>
            execute("object", "{}",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ObjectKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ObjectLiteralExpression)));
                
        describe("for complex object", () =>
            execute('{x: number, "y": {4: boolean}}', '{x: 5, "y": {4: true}}',
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.TypeLiteral),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ObjectLiteralExpression)));

        describe("array", () =>
            execute("number[]", "[]",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayLiteralExpression)));

        describe("function result 1", () =>
            executeWithSetup("function f(): number { return 5 }", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("function result 2", () =>
            executeWithSetup("const f: () => number = null as any;", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("function result 3", () =>
            executeWithSetup("const f: (() => number) = null as any;", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("function result 4", () =>
            executeWithSetup("const f = function (): number { return 5 };", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("arrow function result 4", () =>
            executeWithSetup("const f = (): number => { return 5 };", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("function result 5", () =>
            executeWithSetup("const f = function (): (number) { return 5 };", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("arrow function result 5", () =>
            executeWithSetup("const f = (): (number | string) => { return 5 };", "(number | string)", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.UnionType),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.UnionType)));

        describe("function result 6", () =>
            executeWithSetup("const f = (function (): number { return 5 });", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("function result 6", () =>
            executeWithSetup("const f = ((): number => { return 5 });", "number", "f()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("function result 7", () =>
            execute("number", "(function (): number { return 5 }())",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("function result 8", () =>
            execute("number", "(function (): number { return 5 })()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

        describe("arrow function result 8", () =>
            execute("number", "((): number => { return 5 })()",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword),
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.NumberKeyword)));

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

    describe("variable without type", () => {
        
        it("should resolve var without type as any", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
var x;
validate(x);`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression(arg, file);
            result.kind.should.eq(ts.SyntaxKind.AnyKeyword);
        });
    });

    describe("type from function args", () => {
        it("should resolve arg with type", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
function doSomething(x: string) {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression(arg, file);
            (result as ts.TypeNode).kind.should.eq(ts.SyntaxKind.StringKeyword);
        });
        
        it("should resolve arg without type as any", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
function doSomething(x) {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression(arg, file);
            result.kind.should.eq(ts.SyntaxKind.AnyKeyword);
        });
    });

    describe("type from arrow function args", () => {
        it("should resolve arg with type", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
const doSomething = (x: string) => {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression(arg, file);
            (result as ts.TypeNode).kind.should.eq(ts.SyntaxKind.StringKeyword);
        });
        
        it("should resolve arg without type as any", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
const doSomething = (x) => {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression(arg, file);
            result.kind.should.eq(ts.SyntaxKind.AnyKeyword);
        });
    });

    describe("functions with dotdotdot args", () => {
        it("should resolve arg with type", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
const doSomething = (...x: string[]) => {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression(arg, file);
            (result as ts.TypeNode).kind.should.eq(ts.SyntaxKind.ArrayType);
        });
    });
});
