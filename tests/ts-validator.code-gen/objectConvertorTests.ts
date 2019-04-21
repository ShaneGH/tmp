import * as chai from 'chai';
import * as ts from 'typescript';
import * as types from 'ts-validator.core';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as _ from 'lodash';
import { resolveObject } from '../../ts-validator.code-gen/src/objectConvertor';
import { UnknownExpression } from '../../ts-validator.code-gen/src/expressionTypeResolver';

chai.should();

describe("objectConvertor", function () {

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

    function resolve(code: string) {

        const file = createFile("var t = " + code + ";");
        const obj = tsquery<ts.VariableDeclaration>(file, "VariableDeclaration");
        if (!obj.length) {
            print(file);
            throw new Error("Could not find var.");
        }

        const init = obj[0].initializer;
        if (!init) {
            print(file);
            throw new Error("Could not find initializer.");
        }

        if (ts.isObjectLiteralExpression(init) || ts.isArrayLiteralExpression(init)) {
            return resolveObject(init, file);
        }

        return resolveObject(new UnknownExpression(init.kind), file);
    }

    describe("literals", () => {
        
        it("should resolve string 1", () => resolve("'hi'").should.eq(types.PropertyKeyword.string));
        it("should resolve string 2", () => resolve('"hi"').should.eq(types.PropertyKeyword.string));
        it("should resolve string 3", () => resolve('`hi`').should.eq(types.PropertyKeyword.string));
        it("should resolve string 4", () => resolve('`${66}`').should.eq(types.PropertyKeyword.string));
        it("should resolve number", () => resolve("5").should.eq(types.PropertyKeyword.number));
        it("should resolve true", () => resolve("true").should.eq(types.PropertyKeyword.boolean));
        it("should resolve false", () => resolve("false").should.eq(types.PropertyKeyword.boolean));
        it("should resolve null", () => resolve("null").should.eq(types.PropertyKeyword.null));
        it("should resolve undefined", () => resolveObject(new UnknownExpression(ts.SyntaxKind.UndefinedKeyword), null as any).should.eq(types.PropertyKeyword.undefined));
    });

    describe("objects", () => {
        it("should resolve oject with properties", () => {
            const result = resolve("{val: 6, \"val2\": null}") as types.Properties;
            result.properties.length.should.eq(2);
            result.properties[0].name.should.eq("val");
            result.properties[0].type.should.eq(types.PropertyKeyword.number);
            result.properties[1].name.should.eq("val2");
            result.properties[1].type.should.eq(types.PropertyKeyword.null);
        });

        it("should resolve oject with nested properties", () => {
            const outer = resolve("{vl: { val: 6, \"val2\": null} }") as types.Properties;
            outer.properties.length.should.eq(1);
            outer.properties[0].name.should.eq("vl");
            outer.properties[0].type.should.be.instanceof(types.Properties);
            
            const inner = outer.properties[0].type as types.Properties;
            inner.properties.length.should.eq(2);
            inner.properties[0].name.should.eq("val");
            inner.properties[0].type.should.eq(types.PropertyKeyword.number);
            inner.properties[1].name.should.eq("val2");
            inner.properties[1].type.should.eq(types.PropertyKeyword.null);
        });

        it("should resolve oject with array", () => {
            const outer = resolve("{vl: ['hello'] }") as types.Properties;
            outer.properties.length.should.eq(1);
            outer.properties[0].name.should.eq("vl");
            outer.properties[0].type.should.be.instanceof(types.ArrayType);
            
            const inner = outer.properties[0].type as types.ArrayType;
            inner.type.should.eq(types.PropertyKeyword.string);
        });
    });

    describe("arrays", () => {
        it("should resolve empty array", () => {
            const result = resolve("[]") as types.ArrayType;
            result.type.should.eq(types.PropertyKeyword.never);
        });
        
        it("should resolve array with one element", () => {
            const result = resolve("[3]") as types.ArrayType;
            result.type.should.eq(types.PropertyKeyword.number);
        });
        
        it("should resolve array with two equal elements", () => {
            const result = resolve("[3, 5]") as types.ArrayType;
            result.type.should.eq(types.PropertyKeyword.number);
        });
        
        it("should resolve array with two different elements", () => {
            const result = resolve("[3, \"5\"]") as types.ArrayType;
            result.type.should.be.instanceof(types.MultiType);

            const results = result.type as types.MultiType;
            results.combinator.should.eq(types.MultiTypeCombinator.Union);
            results.types.length.should.eq(2);
            results.types[0].should.eq(types.PropertyKeyword.number);
            results.types[1].should.eq(types.PropertyKeyword.string);
        });
    });
});
