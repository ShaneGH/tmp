import * as chai from 'chai';
import * as ts from 'typescript';
import * as types from 'ts-validator.core';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as _ from 'lodash';
import { convertType } from '../../ts-validator.code-gen/src/typeConvertor';

chai.should();

describe("nodeParser", function () {

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

        const type = convertType(variableTypes[variableTypes.length - 1], file, "testFile.ts");
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

        if (!testSerializer) return type;

        const ser = JSON.parse(JSON.stringify(types.serialize([type])));
        const t = _(types.deserialize(ser).enumerate())
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
                ((type.aliases as types.Properties).properties as types.Property[]).length.should.equal(6);
                type.name.should.equal(name);
            });

            const ps = (type.aliases as types.Properties).properties;

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
                ((type as types.AliasedType).aliases as types.Properties).properties.length.should.equal(1);
                firstProperty = ((type as types.AliasedType).aliases as types.Properties).properties[0];
            });

            describe("should parse complex properties", () => {

                it("should parse complex property", () => {
                    firstProperty.name.should.equal("prop1");
                    chai.assert.equal(firstProperty.type.constructor, types.Properties);
                    (<types.Properties>firstProperty.type).properties.length.should.equal(2);
                });

                describe("should parse inner properties", () => {

                    it("should parse string properties", () => {
                        const innerT = (firstProperty.type as types.Properties);
                        innerT.properties[0].name.should.equal("prop2");
                        innerT.properties[0].type.should.equal(types.PropertyKeyword.string);
                    });

                    it("should parse number properties", () => {
                        const innerT = (firstProperty.type as types.Properties);
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
        
        //runForDeclaration("type MyType = ", "MyType");

        describe(`should parse type alias`, function () {
            
            const type = resolveType("interface MyI { prop1: string }\ntype MyT = MyI", "MyT") as types.AliasedType;
            let aliasedTypeName: string;
            let aliasedTypeProperties: types.Property[];

            it("should parse correct type and property length", () => {
                type.name.should.equal("MyT");
                aliasedTypeName = (type.aliases as types.LazyTypeReference).getType().name;
                aliasedTypeProperties = ((type.aliases as types.LazyTypeReference).getType().aliases as types.Properties).properties;
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
                const type = resolveType("type MyT = " + aliasedType.keyword, "MyT") as types.AliasedType;

                it("should parse correct type and property aliased value", () => {
                    type.name.should.equal("MyT");
                    type.aliases.should.equal(aliasedType);
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
            
            ((type as types.AliasedType).aliases as types.LazyTypeReference).getType().name.should.equal("MyI");
            ((type as types.AliasedType).aliases as types.LazyTypeReference).id.should.equal("0-31, testFile.ts");
        });
    });

    function inheritance (classOrInterface: "class" | "interface") {
        describe(classOrInterface + " inheritance", function () {

            const type = resolveType(
                `${classOrInterface} My1 { prop1: string }\n${classOrInterface} My2 extends My1 { prop2: number }`, "My2"
                ) as types.AliasedType;

            const properties = (type.aliases as types.MultiType).types[0] as types.Properties;
            const extended = (type.aliases as types.MultiType).types[1] as types.LazyTypeReference;
            const combinator = (type.aliases as types.MultiType).combinator;

            it("should parse type as intersection type", () => {
                type.name.should.equal("My2");

                properties.should.be.instanceof(types.Properties);
                combinator.should.be.eq(types.MultiTypeCombinator.Intersection);
                extended.should.be.instanceof(types.LazyTypeReference);
            });

            it("should have the correct properties", () => {
                properties.properties.length.should.eq(1);
                properties.properties[0].name.should.eq("prop2");
                properties.properties[0].type.should.eq(types.PropertyKeyword.number);
            });

            it("should have the extends", () => {

                extended.getType().name.should.be.eq("My1");
                (extended.getType().aliases as types.Properties).properties.length.should.eq(1);
                (extended.getType().aliases as types.Properties).properties[0].name.should.eq("prop1");
                (extended.getType().aliases as types.Properties).properties[0].type.should.eq(types.PropertyKeyword.string);
            });
        });
    }

    inheritance("class");
    inheritance("interface");

    describe("type recursion", () => {
        const type = resolveType(`interface My1 { prop1: My1 }`, "My1") as types.AliasedType;

        it("should construct interface properly", () => {
            type.name.should.be.eq("My1");
            (type.aliases as types.Properties).properties.length.should.be.eq(1);
            (type.aliases as types.Properties).properties[0].name.should.be.eq("prop1");
            (type.aliases as types.Properties).properties[0].type.should.be.instanceof(types.LazyTypeReference);
        });

        it("should have the same type reference for interface and property", () => {
            const propType = ((type.aliases as types.Properties).properties[0].type as types.LazyTypeReference).getType();
            propType.should.be.eq(type);
        });
    });

    function MultiTypes(combinator: types.MultiTypeCombinator) {
        const name = combinator === types.MultiTypeCombinator.Union ? "union" : "intersection";
        const t = combinator === types.MultiTypeCombinator.Union ? "|" : "&";

        describe(name + " types", () => {
            describe("horizontal", () => {

                const type = resolveType(`type T1 = string ${t} number ${t} boolean`, "T1") as types.AliasedType;
                const stringType = (type.aliases as types.MultiType).types[0];
                const numberType = (type.aliases as types.MultiType).types[1];
                const booleanType = (type.aliases as types.MultiType).types[2];

                it("should construct type properly", () => {
                    type.name.should.be.eq("T1");
                    type.aliases.should.be.instanceof(types.MultiType);
                    (type.aliases as types.MultiType).combinator.should.be.eq(combinator);
                    
                    stringType.should.eq(types.PropertyKeyword.string);
                    numberType.should.eq(types.PropertyKeyword.number);
                    booleanType.should.eq(types.PropertyKeyword.boolean);
                });
            });
            
            describe("nested", () => {

                const type = resolveType(`type T1 = string; type T2 = {val: string}; type T3 = T1 ${t} T2`, "T3") as types.AliasedType;
                const left = (type.aliases as types.MultiType).types[0] as types.LazyTypeReference;
                const right = (type.aliases as types.MultiType).types[1] as types.LazyTypeReference;

                it("should construct type properly", () => {
                    type.name.should.be.eq("T3");
                    left.should.be.instanceof(types.LazyTypeReference);
                    right.should.be.instanceof(types.LazyTypeReference);

                    (type.aliases as types.MultiType).combinator.should.eq(combinator);
                });

                it("should construct left correctly", () => {
                    left.getType().name.should.eq("T1");
                    left.getType().aliases.should.eq(types.PropertyKeyword.string);
                });

                it("should construct right correctly", () => {
                    right.getType().name.should.eq("T2");
                    (right.getType().aliases as types.Properties).properties.length.should.eq(1);
                    (right.getType().aliases as types.Properties).properties[0].name.should.eq("val");
                    (right.getType().aliases as types.Properties).properties[0].type.should.eq(types.PropertyKeyword.string);
                });
            });
        });
    }

    MultiTypes(types.MultiTypeCombinator.Union);
    MultiTypes(types.MultiTypeCombinator.Intersection);
    
    describe("intersection and union types combined", () => {

        const type = resolveType(`type T1 = string & number | boolean`, "T1") as types.AliasedType;
        const stringNumberType = (type.aliases as types.MultiType).types[0] as types.MultiType;
        const booleanType = (type.aliases as types.MultiType).types[1];

        it("should construct type properly", () => {
            type.name.should.be.eq("T1");
            type.aliases.should.be.instanceof(types.MultiType);
            stringNumberType.should.be.instanceof(types.MultiType);

            (type.aliases as types.MultiType).combinator.should.be.eq(types.MultiTypeCombinator.Union);
            stringNumberType.combinator.should.be.eq(types.MultiTypeCombinator.Intersection);
        });

        it("should use correct types", () => {
            booleanType.should.eq(types.PropertyKeyword.boolean);
            stringNumberType.types[0].should.eq(types.PropertyKeyword.string);
            stringNumberType.types[1].should.eq(types.PropertyKeyword.number);
        });
    });
    
    describe("intersection and union types with parentiesis", () => {

        const type = resolveType(`type T1 = (string & number) | boolean`, "T1") as types.AliasedType;
        const stringNumberType = (type.aliases as types.MultiType).types[0] as types.MultiType;
        const booleanType = (type.aliases as types.MultiType).types[1];

        it("should construct type properly", () => {
            type.name.should.be.eq("T1");
            type.aliases.should.be.instanceof(types.MultiType);
            stringNumberType.should.be.instanceof(types.MultiType);

            (type.aliases as types.MultiType).combinator.should.be.eq(types.MultiTypeCombinator.Union);
            stringNumberType.combinator.should.be.eq(types.MultiTypeCombinator.Intersection);
        });

        it("should use correct types", () => {
            booleanType.should.eq(types.PropertyKeyword.boolean);
            stringNumberType.types[0].should.eq(types.PropertyKeyword.string);
            stringNumberType.types[1].should.eq(types.PropertyKeyword.number);
        });
    });
    
    describe("multi type with properties", () => {

        const type = resolveType(`type T1 = ({val: string} & number)`, "T1") as types.AliasedType;
        const propertiesType = (type.aliases as types.MultiType).types[0] as types.Properties;
        const numberType = (type.aliases as types.MultiType).types[1] as types.PropertyKeyword;

        it("should construct type properly", () => {
            type.name.should.be.eq("T1");
            type.aliases.should.be.instanceof(types.MultiType);
            propertiesType.should.be.instanceof(types.Properties);
            numberType.should.be.instanceof(types.PropertyKeyword);
        });

        it("should use correct types", () => {
            numberType.should.eq(types.PropertyKeyword.number);
            propertiesType.properties.length.should.eq(1);
            propertiesType.properties[0].name.should.eq("val");
            propertiesType.properties[0].type.should.eq(types.PropertyKeyword.string);
        });
    });
    
    describe("array types", () => {

        it("should construct type properly", () => {
            const type = resolveType(`type T1 = string[]`, "T1") as types.AliasedType;

            type.name.should.be.eq("T1");
            type.should.be.instanceof(types.AliasedType);
            type.aliases.should.be.instanceof(types.ArrayType);
            
            (type.aliases as types.ArrayType).type.should.eq(types.PropertyKeyword.string);
        });

        it("should construct more complex type properly", () => {
            const type = resolveType(`type T1 = ({val: number} | boolean)[]`, "T1") as types.AliasedType;

            type.name.should.be.eq("T1");
            type.should.be.instanceof(types.AliasedType);
            type.aliases.should.be.instanceof(types.ArrayType);
            
            (type.aliases as types.ArrayType).type.should.be.instanceof(types.MultiType);
        });
    });
});
