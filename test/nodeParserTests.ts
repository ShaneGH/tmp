import * as chai from 'chai';
import * as ts from 'typescript';
import * as nodeParser from '../src/nodeParser';

chai.should();

describe("nodeParser", function () {
    function createFile(text: string) {

        return ts.createSourceFile(
            'testFile.ts', text, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS
        );
    }

    function runForDeclaration(classOrInterface: string, name: string) {
        
        describe("should parse simple properties from interface", function () {
            const file = createFile(classOrInterface + "{ prop1: string; prop2: number; prop3: boolean; prop4: any; prop5: null; prop6: undefined }");
            const types = nodeParser.parser(file);

            it("should parse correct name type and property length", () => {
                types.length.should.equal(1);
                types[0].properties.length.should.equal(6);
                types[0].name.should.equal(name);
            });

            const ps = types[0].properties as nodeParser.Property[];

            it("should parse string properties", () => {
                ps[0].name.should.equal("prop1");
                ps[0].type.should.equal("string");
            });

            it("should parse number properties", () => {
                ps[1].name.should.equal("prop2");
                ps[1].type.should.equal("number");
            });

            it("should parse boolean properties", () => {
                ps[2].name.should.equal("prop3");
                ps[2].type.should.equal("boolean");
            });

            it("should parse any properties", () => {
                ps[3].name.should.equal("prop4");
                ps[3].type.should.equal("any");
            });

            it("should parse null properties", () => {
                ps[4].name.should.equal("prop5");
                ps[4].type.should.equal("null");
            });

            it("should parse undefined properties", () => {
                ps[5].name.should.equal("prop6");
                ps[5].type.should.equal("undefined");
            });
        });

        describe("should parse complex properties from interface", function () {
            const file = createFile(classOrInterface + "{ prop1: { prop2: string, prop3: number } }");
            const types = nodeParser.parser(file);

            it("should parse correct type and property length", () => {
                types.length.should.equal(1);
                types[0].properties.length.should.equal(1);
            });

            const ps = types[0].properties as nodeParser.Property[];

            describe("should parse complex properties", () => {

                it("should parse complex property", () => {
                    ps[0].name.should.equal("prop1");
                    chai.assert.equal(ps[0].type.constructor, Array);
                    (<nodeParser.PropertyWrapper[]>ps[0].type).length.should.equal(2);
                });

                describe("should parse inner properties", () => {

                    const innerT = ps[0].type as nodeParser.PropertyWrapper[];

                    it("should parse string properties", () => {
                        innerT[0].property.name.should.equal("prop2");
                        innerT[0].property.type.should.equal("string");
                    });

                    it("should parse number properties", () => {
                        innerT[1].property.name.should.equal("prop3");
                        innerT[1].property.type.should.equal("number");
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
            
            const file = createFile("interface MyI { prop1: string }\ntype MyT = MyI");
            const types = nodeParser.parser(file);

            it("should parse correct type and property length", () => {
                types.length.should.equal(2);

                types[0].name.should.equal("MyI");
                types[0].properties.length.should.equal(1);
                types[1].name.should.equal("MyT");
                types[1].properties.length.should.equal(1);
            });

            it("should parse first property", () => {
                types[1].properties.length.should.equal(1);
                (types[1].properties[0] as nodeParser.Property).name.should.equal("prop1");
                (types[1].properties[0] as nodeParser.Property).type.should.equal("string");

            });
        });

        function runForTypeAlias(aliasedType: string) {

            describe(`should parse type alias: ${aliasedType}`, function () {
                const file = createFile("type MyT = " + aliasedType);
                const types = nodeParser.parser(file);

                it("should parse correct type and property aliased value", () => {
                    types.length.should.equal(1);

                    types[0].name.should.equal("MyT");
                    (types[0].properties as nodeParser.PropertyKeyword).should.equal(aliasedType);
                });
            });
        }

        runForTypeAlias("string");
        runForTypeAlias("number");
        runForTypeAlias("boolean");
        runForTypeAlias("any");
        runForTypeAlias("null");
        runForTypeAlias("undefined");
    });

    function inheritance (type: "class" | "interface") { 
        describe(type + " inheritance", function () {

            const file = createFile(`${type} My1 { prop1: string }\n${type} My2 extends My1 { prop2: number }`);
            const types = nodeParser.parser(file);

            it("should parse types", () => {
                types.length.should.equal(2);
                types[0].name.should.equal("My1");
                types[1].name.should.equal("My2");
            });

            const inherited = types[1];

            it("should have the correct properties", () => {
                const props = inherited.properties as nodeParser.Property[];

                props.length.should.equal(2);
                props[0].name.should.equal("prop1");
                props[0].type.should.equal("string");
                props[1].name.should.equal("prop2");
                props[1].type.should.equal("number");
            });
        });
    }

    inheritance("class");
    inheritance("interface");
});
