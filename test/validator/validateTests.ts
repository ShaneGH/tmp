import * as chai from 'chai';
import * as ts from 'typescript';
import * as types from '../../src/validation-rewriter/types';
import { tsquery } from '@phenomnomnominal/tsquery';
import { validate, CompilerArgs } from '../../src/validator/validate';

chai.should();

describe("validator", function () {
    function pad(text: string, pad: number) {
        var p = "";
        for (var i = 0; i < pad; i++) p += "  ";

        return text.split("\n").map(x => pad + "-" + p + x).join("\n");
    }

    function print(node: ts.Node, recurse = true, level = 0) {
        console.log(pad(ts.SyntaxKind[node.kind] + ": " + node.getFullText(), level));
        if (recurse) node.getChildren().map(x => print(x, recurse, level + 1));
    }

    function createFile(text: string) {
        return ts.createSourceFile(
            'testFile.ts', text, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
        );
    }

    function resolveType(code: string, typeName: string, testSerializer = true) {
        const file = createFile(code + "\nvar t: " + typeName + ";");
        const variableTypes = tsquery<ts.TypeReferenceNode>(file, "VariableDeclaration TypeReference");
        if (!variableTypes.length) {
            print(file);
            throw new Error("Could not find variable.");
        }

        const type = types.resolveType(variableTypes[variableTypes.length - 1], file, "testFile.ts");
        if (!type) {
            print(file);
            throw new Error("Could not resolve type.");
        }

        if (!(type instanceof types.AliasedType)) {
            print(file);
            console.error(type);
            throw new Error(`Error defining code. Expected TypeWithProperties or AliasedType`);
        }

        if (type.name !== typeName) {
            print(file);
            throw new Error(`Error defining code. Expected name: ${typeName}, actual name: ${type.name}`);
        }
        
        return type;
    }

    type OptionalCompilerArgs = {
        strictNullChecks?: boolean
    }

    function buildCompilerArgs(vals?: OptionalCompilerArgs): CompilerArgs {
        vals = vals || {};
        return {
            strictNullChecks: vals.strictNullChecks == null ? true : vals.strictNullChecks
        };
    }

    describe("Smoke test", () => {
        it("should validate type with no properties", () => {
            const t1 = resolveType("type T1 = {}", "T1");
            validate({}, t1, buildCompilerArgs()).should.eq(true);
        })
    });

    describe("property with keywords", () => {
        function execute (typeName: string, typeValue: any) {
            const t1 = resolveType(`type T1 = {x: ${typeName}}`, "T1");
            const t2 = resolveType(`type T2 = { y: { x: ${typeName}} }`, "T2");

            it(`should validate ${typeName} prop`, () => {
                validate({x: typeValue}, t1, buildCompilerArgs()).should.eq(true);
            });

            const notValue = typeName === "number" ? "not a number" : 7;
            it(`should invalidate non ${typeName} prop`, () => {
                validate({x: notValue}, t1, buildCompilerArgs()).should.eq(false);
            });

            it(`should validate ${typeName} inner prop`, () => {
                validate({y: {x: typeValue}}, t2, buildCompilerArgs()).should.eq(true);
            });

            it(`should invalidate non ${typeName} inner prop`, () => {
                validate({y: {x: notValue}}, t2, buildCompilerArgs()).should.eq(false);
            });
        }

        execute("string", "hello");
        execute("number", 4);
        execute("boolean", true);
        execute("null", null);
        execute("undefined", undefined);

        describe("any", () => {
            const t1 = resolveType(`type T1 = {x: any`, "T1");

            it(`should validate any prop`, () => {
                validate({x: 4}, t1, buildCompilerArgs()).should.eq(true);
                validate({x: null}, t1, buildCompilerArgs()).should.eq(true);
                validate({x: new Date()}, t1, buildCompilerArgs()).should.eq(true);
            });
        });

        describe("never", () => {
            const t1 = resolveType(`type T1 = {x: never`, "T1");

            it(`should invalidate never prop`, () => {
                validate({x: 4}, t1, buildCompilerArgs()).should.eq(false);
                validate({x: null}, t1, buildCompilerArgs()).should.eq(false);
                validate({x: new Date()}, t1, buildCompilerArgs()).should.eq(false);
            });
        });
    });

    describe("extends tests", () => {
        describe("single inheritance", () => {
            function execute (typeName: string, typeValue: any) {
                const t2 = resolveType(`interface T1 {x: ${typeName}}\r\ninterface T2 extends T1 { }`, "T2");

                it(`should validate ${typeName} prop`, () => {
                    validate({x: typeValue}, t2, buildCompilerArgs()).should.eq(true);
                });

                const notValue = typeName === "number" ? "not a number" : 7;
                it(`should invalidate non ${typeName} prop`, () => {
                    validate({x: notValue}, t2, buildCompilerArgs()).should.eq(false);
                });
            }

            execute("string", "hello");
            execute("number", 4);
        });
        
        describe("multiple inheritance, horizontal", () => {
            const t2 = resolveType(`interface T1 {x: string}\r\ninterface T2 {y: number}\r\ninterface T3 extends T1, T2 { }`, "T3");

            it(`should validate if both props ok`, () => {
                validate({x: "hi", y: 6}, t2, buildCompilerArgs()).should.eq(true);
            });

            it(`should not validate if one prop is bad`, () => {
                validate({x: "hi", y: "6"}, t2, buildCompilerArgs()).should.eq(false);
            });

            it(`should not validate if one other is bad`, () => {
                validate({y: 6}, t2, buildCompilerArgs()).should.eq(false);
            });
        });
        
        describe("multiple inheritance, vertical", () => {
            const t2 = resolveType(`interface T1 {x: string}\r\ninterface T2 extends T1 {y: number}\r\ninterface T3 extends T2 { }`, "T3");

            it(`should validate if both props ok`, () => {
                validate({x: "hi", y: 6}, t2, buildCompilerArgs()).should.eq(true);
            });

            it(`should not validate if one prop is bad`, () => {
                validate({x: "hi", y: "6"}, t2, buildCompilerArgs()).should.eq(false);
            });

            it(`should not validate if one other is bad`, () => {
                validate({y: 6}, t2, buildCompilerArgs()).should.eq(false);
            });
        });
    });

    describe("type alias tests", () => {
        function execute (typeName: string, typeValue: any) {
            const t2 = resolveType(`type T1 = {x: ${typeName}};\r\ntype T2 = T1;`, "T2");

            it(`should validate ${typeName} prop`, () => {
                validate({x: typeValue}, t2, buildCompilerArgs()).should.eq(true);
            });

            const notValue = typeName === "number" ? "not a number" : 7;
            it(`should invalidate non ${typeName} prop`, () => {
                validate({x: notValue}, t2, buildCompilerArgs()).should.eq(false);
            });
        }

        execute("string", "hello");
        execute("number", 4);
    });

    describe("strictNullChecks", () => {
        describe("input is null or undefined and no null checks", () => {
            const compilerArgs = buildCompilerArgs({strictNullChecks: false});
            const t1 = resolveType(`type T1 = {x: string}`, "T1");

            it(`should validate null input`, () => {
                validate(null, t1, compilerArgs).should.eq(true);
            });
            
            it(`should validate undefined input`, () => {
                validate(undefined, t1, compilerArgs).should.eq(true);
            });
        });
        
        describe("input is null or undefined and null checks", () => {
            const compilerArgs = buildCompilerArgs({strictNullChecks: true});
            const t1 = resolveType(`type T1 = {x: string}`, "T1");

            it(`should invalidate null input`, () => {
                validate(null, t1, compilerArgs).should.eq(false);
            });
            
            it(`should invalidate undefined input`, () => {
                validate(undefined, t1, compilerArgs).should.eq(false);
            });
        });

        describe("inner properties are null or undefined", () => {
            const compilerArgs = buildCompilerArgs({strictNullChecks: false});
            const t1 = resolveType(`type T1 = {x: string}`, "T1");

            it(`should validate string prop`, () => {
                validate({x: "hello"}, t1, compilerArgs).should.eq(true);
            });

            it(`should validate undefined prop`, () => {
                validate({x: undefined}, t1, compilerArgs).should.eq(true);
            });

            it(`should validate null prop`, () => {
                validate({x: null}, t1, compilerArgs).should.eq(true);
            });

            it(`should invalidate non string prop`, () => {
                validate({x: 5}, t1, compilerArgs).should.eq(false);
            });

            const t2 = resolveType(`type T2 = { y: { x: string} }`, "T2");
            it(`should validate string inner prop`, () => {
                validate({y: {x: "hello"}}, t2, compilerArgs).should.eq(true);
            });

            it(`should validate undefined inner prop`, () => {
                validate({y: {x: undefined}}, t2, compilerArgs).should.eq(true);
            });

            it(`should validate null inner prop`, () => {
                validate({y: {x: null}}, t2, compilerArgs).should.eq(true);
            });

            it(`should validate null outer prop`, () => {
                validate({y: null}, t2, compilerArgs).should.eq(true);
            });

            it(`should validate undefined outer prop`, () => {
                validate({y: undefined}, t2, compilerArgs).should.eq(true);
            });

            it(`should invalidate non string inner prop`, () => {
                validate({y: {x: 5}}, t2, compilerArgs).should.eq(false);
            });
        });
    })
});