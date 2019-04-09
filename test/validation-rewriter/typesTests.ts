import * as chai from 'chai';
import * as ts from 'typescript';
import * as types from '../../src/validation-rewriter/types';
import { tsquery } from '@phenomnomnominal/tsquery';
import { deserialize, serialize } from '../../src/validation-rewriter/typeSerializer';
import _ = require('lodash');
import { TypeWrapper } from '../../src/validation-rewriter/types';

chai.should();

describe("nodeParser", function () {
    
    function assertNotNull<T>(x: T | null): x is T {
        if (x === undefined) x = null;
        chai.assert.isNotNull(x);

        return true;
    }

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

        if (type.name !== typeName) {
            print(file);
            throw new Error(`Error defining code. Expected name: ${typeName}, actual name: ${type.name}`);
        }

        if (!testSerializer) return type;

        const ser = JSON.parse(JSON.stringify(serialize([type])));
        const t = _(deserialize(ser).enumerate())
            .filter(x => x.value.name === typeName)
            .map(x => x.value)
            .first();

        if (!t) throw Error(`Could not find type: ${typeName} in deserialized values.`);

        return t;
    }

    function runForDeclaration(classOrInterface: string, name: string) {
        
        describe("should parse simple properties from interface", function () {
            const type = resolveType(classOrInterface + "{ prop1: string; prop2: number; prop3: boolean; prop4: any; prop5: null; prop6: undefined }", name);

            it("should parse correct name type and property length", () => {
                (type.properties as types.Property[]).length.should.equal(6);
                type.name.should.equal(name);
            });

            const ps = type.properties as types.Property[];

            it("should parse string properties", () => {
                ps[0].name.should.equal("prop1");
                ps[0].type.should.equal(types.PropertyKeyword.string);
            });

            it("should parse number properties", () => {
                ps[1].name.should.equal("prop2");
                ps[1].type.should.equal(types.PropertyKeyword.number);
            });

            it("should parse boolean properties", () => {
                ps[2].name.should.equal("prop3");
                ps[2].type.should.equal(types.PropertyKeyword.boolean);
            });

            it("should parse any properties", () => {
                ps[3].name.should.equal("prop4");
                ps[3].type.should.equal(types.PropertyKeyword.any);
            });

            it("should parse null properties", () => {
                ps[4].name.should.equal("prop5");
                ps[4].type.should.equal(types.PropertyKeyword.null);
            });

            it("should parse undefined properties", () => {
                ps[5].name.should.equal("prop6");
                ps[5].type.should.equal(types.PropertyKeyword.undefined);
            });
        });

        describe("should parse complex properties from interface", function () {
            const type = resolveType(classOrInterface + "{ prop1: { prop2: string, prop3: number } }", name);

            let firstProperty: types.Property;
            it("should parse correct type and property length", () => {
                (type.properties as types.Property[]).length.should.equal(1);
                firstProperty = (type.properties as types.Property[])[0];
            });

            describe("should parse complex properties", () => {

                it("should parse complex property", () => {
                    firstProperty.name.should.equal("prop1");
                    chai.assert.equal(firstProperty.type.constructor, types.PropertiesWrapper);
                    (<types.PropertiesWrapper>firstProperty.type).properties.length.should.equal(2);
                });

                describe("should parse inner properties", () => {

                    it("should parse string properties", () => {
                        const innerT = (firstProperty.type as types.PropertiesWrapper);
                        innerT.properties[0].name.should.equal("prop2");
                        innerT.properties[0].type.should.equal(types.PropertyKeyword.string);
                    });

                    it("should parse number properties", () => {
                        const innerT = (firstProperty.type as types.PropertiesWrapper);
                        innerT.properties[1].name.should.equal("prop3");
                        innerT.properties[1].type.should.equal(types.PropertyKeyword.number);
                    });
               });
            });
        });
    }

    describe("interfaces", function () {
        runForDeclaration("interface MyInterface ", "MyInterface");
    });

    describe("classes", function () {
        runForDeclaration("class MyClass ", "MyClass");
    });

    describe("types", function () {
        
        runForDeclaration("type MyType = ", "MyType");

        describe(`should parse type alias`, function () {
            
            const type = resolveType("interface MyI { prop1: string }\ntype MyT = MyI", "MyT");
            let aliasedTypeName: string;
            let aliasedTypeProperties: types.Property[];

            it("should parse correct type and property length", () => {
                type.name.should.equal("MyT");
                if (assertNotNull(type.extends)) {
                    aliasedTypeName = (type.extends as types.TypeWrapper).getType().name;
                    aliasedTypeProperties = (type.extends as types.TypeWrapper).getType().properties as types.Property[];
                }
            });

            it("should parse first property", () => {
                aliasedTypeName.should.equal("MyI");
                aliasedTypeProperties.length.should.equal(1);
                aliasedTypeProperties[0].name.should.equal("prop1");
                aliasedTypeProperties[0].type.should.equal(types.PropertyKeyword.string);

            });
        });

        function runForTypeAlias(aliasedType: types.PropertyKeyword) {

            describe(`should parse type alias: ${aliasedType.keyword}`, function () {
                const type = resolveType("type MyT = " + aliasedType.keyword, "MyT");

                it("should parse correct type and property aliased value", () => {
                    type.name.should.equal("MyT");
                    (type.extends as types.PropertyKeyword).should.equal(aliasedType);
                });
            });
        }

        runForTypeAlias(types.PropertyKeyword.string);
        runForTypeAlias(types.PropertyKeyword.number);
        runForTypeAlias(types.PropertyKeyword.boolean);
        runForTypeAlias(types.PropertyKeyword.null);
        runForTypeAlias(types.PropertyKeyword.undefined);
        runForTypeAlias(types.PropertyKeyword.any);
        runForTypeAlias(types.PropertyKeyword.never);
        runForTypeAlias(types.PropertyKeyword.unknown);
        runForTypeAlias(types.PropertyKeyword.void);
    });

    describe("type ids", function () {
        const type = resolveType("interface MyI { prop1: string }\ntype MyT = MyI", "MyT");

        it("should parse correct type and property length", () => {
            type.name.should.equal("MyT");
            type.id.should.equal("31-46, testFile.ts");
            
            (type.extends as types.TypeWrapper).getType().name.should.equal("MyI");
            (type.extends as types.TypeWrapper).getType().id.should.equal("0-31, testFile.ts");
        });
    });

    function inheritance (classOrInterface: "class" | "interface") {
        describe(classOrInterface + " inheritance", function () {

            const type = resolveType(`${classOrInterface} My1 { prop1: string }\n${classOrInterface} My2 extends My1 { prop2: number }`, "My2");

            it("should parse types", () => {
                type.name.should.equal("My2");

                if (assertNotNull(type.extends)) {
                    (type.extends as TypeWrapper).getType().name.should.equal("My1");
                }
            });

            it("should have the correct properties", () => {
                const props = type.properties as types.Property[];

                const subTypeProps = 
                    (assertNotNull(type.extends) 
                    && (type.extends as types.TypeWrapper).getType().properties) as types.Property[];

                props.length.should.equal(1);
                props[0].name.should.equal("prop2");
                props[0].type.should.equal(types.PropertyKeyword.number);
                
                subTypeProps.length.should.equal(1);
                subTypeProps[0].name.should.equal("prop1");
                subTypeProps[0].type.should.equal(types.PropertyKeyword.string);
            });
        });
    }

    inheritance("class");
    inheritance("interface");

    describe("type recursion", () => {
        const type = resolveType(`interface My1 { prop1: My1 }`, "My1");

        it("should construct interface properly", () => {
            type.name.should.be.eq("My1");
            const props = type.properties as types.Property[];
            props.length.should.be.eq(1);
            props[0].name.should.be.eq("prop1");
            props[0].type.constructor.should.be.eq(types.TypeWrapper);
        });

        it("should have the same type reference for interface and property", () => {
            const props = type.properties as types.Property[];
            (props[0].type as types.TypeWrapper).getType().should.be.eq(type);
        });
    });

    describe("union types", () => {
        const type1 = resolveType(`type T1 = string | number | boolean`, "T1");

        it("should construct type properly", () => {
            type1.name.should.be.eq("T1");
            type1.properties.length.should.be.eq(0);
            if (assertNotNull(type1.extends)) {
                const fullUnion = type1.extends as types.BinaryType;
                fullUnion.combinator.should.eq(types.BinaryTypeCombinator.Union);
                (fullUnion.left as types.BinaryType).combinator.should.eq(types.BinaryTypeCombinator.Union);
                
                const left = ((fullUnion.left as types.BinaryType).left as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                left.keyword.should.eq("string");
                
                const middle = ((fullUnion.left as types.BinaryType).right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                middle.keyword.should.eq("number");
                
                const right = (fullUnion.right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                right.keyword.should.eq("boolean");
            }
        });

        const type2 = resolveType(`type T1 = string; type T2 = {val: string}; type T3 = T1 | T2`, "T3");
        it("should construct nested type properly", () => {
            type2.name.should.be.eq("T3");
            type2.properties.length.should.be.eq(0);
            
            if (assertNotNull(type2.extends)) {
                const fullUnion = type2.extends as types.BinaryType;
                fullUnion.combinator.should.eq(types.BinaryTypeCombinator.Union);
                
                const left = (fullUnion.left as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                left.keyword.should.eq("string");
                
                const right = (fullUnion.right as types.TypeWrapper).getType().properties
                right.length.should.eq(1);
                right[0].name.should.eq("val");
                (right[0].type as types.PropertyKeyword).should.eq(types.PropertyKeyword.string);
            }
        });
    });

    describe("intersection types", () => {
        const type1 = resolveType(`type T1 = string & number & boolean`, "T1");

        it("should construct type properly", () => {
            type1.name.should.be.eq("T1");
            type1.properties.length.should.be.eq(0);
            if (assertNotNull(type1.extends)) {
                const fullIntersection = type1.extends as types.BinaryType;
                fullIntersection.combinator.should.eq(types.BinaryTypeCombinator.Intersection);
                (fullIntersection.left as types.BinaryType).combinator.should.eq(types.BinaryTypeCombinator.Intersection);
                
                const left = ((fullIntersection.left as types.BinaryType).left as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                left.keyword.should.eq("string");
                
                const middle = ((fullIntersection.left as types.BinaryType).right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                middle.keyword.should.eq("number");
                
                const right = (fullIntersection.right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                right.keyword.should.eq("boolean");
            }
        });

        const type2 = resolveType(`type T1 = string; type T2 = {val: string}; type T3 = T1 & T2`, "T3");
        it("should construct nested type properly", () => {
            type2.name.should.be.eq("T3");
            type2.properties.length.should.be.eq(0);
            
            if (assertNotNull(type2.extends)) {
                const fullIntersection = type2.extends as types.BinaryType;
                fullIntersection.combinator.should.eq(types.BinaryTypeCombinator.Intersection);
                
                const left = (fullIntersection.left as types.TypeWrapper).getType().extends as types.PropertyKeyword;
                left.keyword.should.eq("string");
                
                const right = (fullIntersection.right as types.TypeWrapper).getType().properties
                right.length.should.eq(1);
                right[0].name.should.eq("val");
                (right[0].type as types.PropertyKeyword).should.eq(types.PropertyKeyword.string);
            }
        });
    });

    // describe("intersection and union types combined", () => {
    //     const type1 = resolveType(`type T1 = string | number & boolean`, "T1");

    //     it("should construct type properly", () => {
    //         type1.name.should.be.eq("T1");
    //         type1.properties.length.should.be.eq(0);
    //         if (assertNotNull(type1.extends)) {
    //             const fullIntersection = type1.extends as types.BinaryType;
    //             fullIntersection.combinator.should.eq(types.BinaryTypeCombinator.Intersection, "outer");
    //             (fullIntersection.left as types.BinaryType).combinator.should.eq(types.BinaryTypeCombinator.Intersection, "inner");
                
    //             const left = ((fullIntersection.left as types.BinaryType).left as types.TypeWrapper).getType().extends as types.PropertyKeyword;
    //             left.keyword.should.eq("string");
                
    //             const middle = ((fullIntersection.left as types.BinaryType).right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
    //             middle.keyword.should.eq("number");
                
    //             const right = (fullIntersection.right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
    //             right.keyword.should.eq("boolean");
    //         }
    //     });
    // });

    // describe("intersection and union types combined, inverted", () => {
    //     const type1 = resolveType(`type T1 = string & number | boolean`, "T1");

    //     it("should construct type properly", () => {
    //         type1.name.should.be.eq("T1");
    //         type1.properties.length.should.be.eq(0);
    //         if (assertNotNull(type1.extends)) {
    //             const fullIntersection = type1.extends as types.BinaryType;
    //             fullIntersection.combinator.should.eq(types.BinaryTypeCombinator.Intersection, "outer");
    //             (fullIntersection.left as types.BinaryType).combinator.should.eq(types.BinaryTypeCombinator.Intersection, "inner");
                
    //             const left = ((fullIntersection.left as types.BinaryType).left as types.TypeWrapper).getType().extends as types.PropertyKeyword;
    //             left.keyword.should.eq("string");
                
    //             const middle = ((fullIntersection.left as types.BinaryType).right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
    //             middle.keyword.should.eq("number");
                
    //             const right = (fullIntersection.right as types.TypeWrapper).getType().extends as types.PropertyKeyword;
    //             right.keyword.should.eq("boolean");
    //         }
    //     });
    // });
});
