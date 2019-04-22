import * as chai from 'chai';
import * as ts from 'typescript';
import * as types from 'ts-validator.core';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as _ from 'lodash';
import { resolveObject } from '../../ts-validator.code-gen/src/objectConvertor';
import { UnknownExpression } from '../../ts-validator.code-gen/src/expressionTypeResolver';
import { PropertyType, PropertyKeyword, Properties } from 'ts-validator.core';
import { scenario } from '../utils';

chai.should();

describe("objectConvertor", function () {

    function randomBool() {
        return Math.floor(Math.random() * Math.floor(2)) == 0;
    }

    function ex(code: string) {
        
        return randomBool()
            ? scenario("t", { validateSetup: "var t = " + code }).type()
            : scenario(code).type()
    }

    function ensureType<T>(x: any, constrT: Function): x is T {
        if (x instanceof constrT) return true;
        throw new Error("Invalid type");
    }

    describe("literals", () => {
        
        it("should resolve string 1", () => ex("'hi'").should.eq(types.PropertyKeyword.string));
        it("should resolve string 2", () => ex('"hi"').should.eq(types.PropertyKeyword.string));
        it("should resolve string 3", () => ex('`hi`').should.eq(types.PropertyKeyword.string));
        it("should resolve string 4", () => ex('`${66}`').should.eq(types.PropertyKeyword.string));
        it("should resolve number", () => ex("5").should.eq(types.PropertyKeyword.number));
        it("should resolve true", () => ex("true").should.eq(types.PropertyKeyword.boolean));
        it("should resolve false", () => ex("false").should.eq(types.PropertyKeyword.boolean));
        it("should resolve null", () => ex("null").should.eq(types.PropertyKeyword.null));
        it("should resolve undefined", () => resolveObject(new UnknownExpression(ts.SyntaxKind.UndefinedKeyword), null as any)(null as any).should.eq(types.PropertyKeyword.undefined));
    });

    describe("objects", () => {
        
        it("should resolve oject with cast 1", () => {
            const type = ex("{ x: 4 as any }");
            if (ensureType<Properties>(type, Properties)) {
                type.properties.length.should.eq(1);
                type.properties[0].name.should.eq("x");
                type.properties[0].type.should.eq(PropertyKeyword.any);
            }
        });
        
        it("should resolve oject with cast 2", () => {
            const type = ex("{ x: <any>4 }");
            if (ensureType<Properties>(type, Properties)) {
                type.properties.length.should.eq(1);
                type.properties[0].name.should.eq("x");
                type.properties[0].type.should.eq(PropertyKeyword.any);
            }
        });
        
        it("should resolve oject with properties", () => {
            const result = ex("{val: 6, \"val2\": null}");
            if (ensureType<Properties>(result, Properties)) {
                result.properties.length.should.eq(2);
                result.properties[0].name.should.eq("val");
                result.properties[0].type.should.eq(types.PropertyKeyword.number);
                result.properties[1].name.should.eq("val2");
                result.properties[1].type.should.eq(types.PropertyKeyword.null);
            }
        });

        it("should resolve oject with nested properties", () => {
            const outer = ex("{vl: { val: 6, \"val2\": null} }");
            if (ensureType<Properties>(outer, Properties)) {
                outer.properties.length.should.eq(1);
                outer.properties[0].name.should.eq("vl");
                outer.properties[0].type.should.be.instanceof(types.Properties);
                
                const inner = outer.properties[0].type as types.Properties;
                inner.properties.length.should.eq(2);
                inner.properties[0].name.should.eq("val");
                inner.properties[0].type.should.eq(types.PropertyKeyword.number);
                inner.properties[1].name.should.eq("val2");
                inner.properties[1].type.should.eq(types.PropertyKeyword.null);
            }
        });

        it("should resolve oject with array", () => {
            const outer = ex("{vl: ['hello'] }");
            if (ensureType<Properties>(outer, Properties)) {
                outer.properties.length.should.eq(1);
                outer.properties[0].name.should.eq("vl");
                outer.properties[0].type.should.be.instanceof(types.ArrayType);
                
                const inner = outer.properties[0].type as types.ArrayType;
                inner.type.should.eq(types.PropertyKeyword.string);
            }
        });
    });

    describe("arrays", () => {
        it("should resolve empty array", () => {
            const result = ex("[]");
            if (ensureType<types.ArrayType>(result, types.ArrayType)) {
                result.type.should.eq(types.PropertyKeyword.never);
            }
        });
        
        it("should resolve array with one element", () => {
            const result = ex("[3]");
            if (ensureType<types.ArrayType>(result, types.ArrayType)) {
                result.type.should.eq(types.PropertyKeyword.number);
            }
        });
        
        it("should resolve array with two equal elements", () => {
            const result = ex("[3, 5]");
            if (ensureType<types.ArrayType>(result, types.ArrayType)) {
                result.type.should.eq(types.PropertyKeyword.number);
            }
        });
        
        it("should resolve array with two different elements", () => {
            const result = ex("[3, \"5\"]");
            if (ensureType<types.ArrayType>(result, types.ArrayType)) {
                result.type.should.be.instanceof(types.MultiType);

                const results = result.type as types.MultiType;
                results.combinator.should.eq(types.MultiTypeCombinator.Union);
                results.types.length.should.eq(2);
                results.types[0].should.eq(types.PropertyKeyword.number);
                results.types[1].should.eq(types.PropertyKeyword.string);
            }
        });
    });
});
