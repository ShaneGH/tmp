import * as chai from 'chai';
import * as ts from 'typescript';
import { transform } from '../../ts-validator.code-gen/src/fileTransformer';
import { PropertyKeyword } from 'ts-validator.core';
import { ArrayCreation, resolveTypeForExpression, ObjectCreation } from '../../ts-validator.code-gen/src/expressionTypeResolver';

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
            explicit: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node> | ArrayCreation<ts.Node>) => void, 
            implicit: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node> | ArrayCreation<ts.Node>) => void, 
            direct?: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node> | ArrayCreation<ts.Node>) => void) {

            return executeWithSetup("", type, value, explicit, implicit, direct);
        }
            
        function executeWithSetup (setup: string, type: string, value: string, 
            explicit: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node> | ArrayCreation<ts.Node>) => void, 
            implicit: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node> | ArrayCreation<ts.Node>) => void, 
            direct?: (x: ts.Node | PropertyKeyword | ObjectCreation<ts.Node> | ArrayCreation<ts.Node>) => void) {
            it("explicit", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
${setup}
let x: ${type} = ${value};
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
                explicit(result);
            });
            
            it("implicit", () => {
                const file = createFile(`import { validate } from 'ts-validator.validator';
${setup}
const x = ${value};
validate(x);`);
                const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
                const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
                implicit(result);
            });
            
            it("direct", () => {
                const ref = getTypeReference(setup, value);
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

        describe("for a parentiesized type", () =>
            execute("(string)", "'hi'",
                x => (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.StringKeyword),
                x => x.should.be.eq(PropertyKeyword.string)));
        
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

        describe("empty array", () =>
            execute("number[]", "[]",
                x => {
                    (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.NumberKeyword);
                },
                x => {
                    (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.AnyKeyword);
                }));

        describe("array with multiple values", () =>
            execute("number[]", "[2, 3]",
                x => {
                    throw new Error("TODO");
                    // (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    // (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.NumberKeyword);
                },
                x => {
                    throw new Error("TODO");
                    // (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    // (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.AnyKeyword);
                }));

        describe("array with multiple types", () =>
            execute("(number | string)[]", "[2, 'val']",
                x => {
                    throw new Error("TODO");
                    // (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    // (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.NumberKeyword);
                },
                x => {
                    throw new Error("TODO");
                    // (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    // (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.AnyKeyword);
                }));

        describe("array with complex object", () =>
            execute("({val: string})[]", "[{val: 'hi'}]",
                x => {
                    throw new Error("TODO");
                    // (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    // (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.NumberKeyword);
                },
                x => {
                    throw new Error("TODO");
                    // (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ArrayType);
                    // (x as ts.ArrayTypeNode).elementType.kind.should.be.eq(ts.SyntaxKind.AnyKeyword);
                }));
                
        describe("for complex object with array  withcomplex object", () =>
            execute("{x: [{y: [{z: number}]}]}", '{x: [{y: [{z: 3}]}]}',
                x => {
                    throw new Error("TODO");
                    (x as ts.Node).kind.should.be.eq(ts.SyntaxKind.ObjectKeyword)
                },
                x => {
                    throw new Error("TODO");
                    // let outer = x as ObjectCreation<ts.Node>;
                    // outer.should.be.instanceOf(ObjectCreation);

                    // outer.values.length.should.eq(2);
                    // outer.values[0].name.should.eq("x", "name");
                    // outer.values[0].value.should.eq(PropertyKeyword.number);
                    
                    // outer.values[1].name.should.eq("y", "name");
                    // let inner = outer.values[1].value as ObjectCreation<ts.Node>;
                    // inner.should.be.instanceOf(ObjectCreation);
                    
                    // inner.values.length.should.eq(1);
                    // inner.values[0].name.should.eq("4", "name");
                    // inner.values[0].value.should.eq(PropertyKeyword.boolean);
                }));

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
            const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
            result.should.eq(PropertyKeyword.any);
        });
    });

    describe("type from function args", () => {
        it("should resolve arg with type", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
function doSomething(x: string) {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
            (result as ts.TypeNode).kind.should.eq(ts.SyntaxKind.StringKeyword);
        });
        
        it("should resolve arg without type as any", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
function doSomething(x) {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
            result.should.eq(PropertyKeyword.any);
        });
    });

    describe("type from arrow function args", () => {
        it("should resolve arg with type", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
const doSomething = (x: string) => {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
            (result as ts.TypeNode).kind.should.eq(ts.SyntaxKind.StringKeyword);
        });
        
        it("should resolve arg without type as any", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
const doSomething = (x) => {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
            result.should.eq(PropertyKeyword.any);
        });
    });

    describe("functions with dotdotdot args", () => {
        it("should resolve arg with type", () => {
            const file = createFile(`import { validate } from 'ts-validator.validator';
const doSomething = (...x: string[]) => {
    validate(x);
}`);

            const arg = transform(file, "tyLoc", "testFile.ts").typeKeys[0].value;
            const result = resolveTypeForExpression<ts.TypeNode>(arg, file)(x => x);
            (result as ts.TypeNode).kind.should.eq(ts.SyntaxKind.ArrayType);
        });
    });
});
