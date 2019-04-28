import * as _ from 'lodash';
import { fullScenario, ArrayValidator, ValidationScenarios } from '../utils';

describe("Aliased types", function () {

    describe("basic interface", () => fullScenario({
        setupCode: ["interface I1 { val: string }"],
        valueCode: '{val: "hello"}',
        typeDefCode: "I1",
        validTest: {val: "hello"},
        invalidTest: new ArrayValidator({val: 4}, 5)
    }));

    describe("basic class", () => fullScenario({
        setupCode: ["class C1 { val: string }"],
        valueCode: '{val: "hello"}',
        typeDefCode: "C1",
        validTest: {val: "hello"},
        invalidTest: new ArrayValidator({val: 4}, 5)
    }));

    describe("basic type", () => fullScenario({
        setupCode: ["type T1 = { val: string }"],
        valueCode: '{val: "hello"}',
        typeDefCode: "T1",
        validTest: {val: "hello"},
        invalidTest: new ArrayValidator({val: 4}, 5)
    }));

    describe("basic type", () => fullScenario({
        setupCode: ["type T1 = { val: string }"],
        valueCode: '{val: "hello"}',
        typeDefCode: "T1",
        validTest: {val: "hello"},
        invalidTest: new ArrayValidator({val: 4}, 5)
    }));

    describe("property with aliased type", () => fullScenario({
        setupCode: ["type T1 = { val: string }", "type T2 = { val2: T1 }"],
        valueCode: '{val2: { val: "hello" } }',
        typeDefCode: "T2",
        validTest: {val2: {val: "hello"}},
        invalidTest: {val2: 5}
    }));

    // https://github.com/ShaneGH/ts-validator/issues/19
    // describe("property with recursive aliased type", () => fullScenario({
    //     setupCode: ["type T1 = { val: string, val2?: T1 }"],
    //     valueCode: '{ val: "hello", val2: {val: "hi", val2: {val: "yes"} } }',
    //     typeDefCode: "T2",
    //     validTest: { val: "hello", val2: {val: "hi", val2: {val: "yes"} } },
    //     invalidTest: { val: "hello", val2: {val: "hi", val2: {val: "yes", val2: 5}} }
    // }));

    describe("type as alias for interface", () => fullScenario({
        setupCode: ["interface I1 { val: string }", "type T2 = I1"],
        valueCode: '{ val: "hello" }',
        typeDefCode: "T2",
        validTest: {val: "hello"},
        invalidTest: {val: 5}
    }));

    describe("type as alias for property keyword", () => fullScenario({
        setupCode: ["type T1 = string"],
        valueCode: '"22"',
        typeDefCode: "T1",
        validTest: "hello",
        invalidTest: false
    }));

    describe("type as alias for union", () => fullScenario({
        setupCode: ["type T1 = string | number"],
        valueCode: '22',
        typeDefCode: "T1",
        validTest: new ArrayValidator("hello", 5),
        invalidTest: false,
        shouldValidate: x => x != ValidationScenarios.direct && x != ValidationScenarios.variable
    }));

    // https://github.com/ShaneGH/ts-validator/issues/41
    // describe("class inheritance", () => fullScenario({
    //     setupCode: ["class C1 { p1: string }", "class C2 extends C1 { p2: number }"],
    //     valueCode: 'new C2()',
    //     typeDefCode: "C2",
    //     validTest: { p1: "hi", p2: 4 },
    //     invalidTest: { p1: "hi" }
    // }));

    describe("interface inheritance", () => fullScenario({
        setupCode: ["interface I1 { p1: string }", "interface I2 extends I1 { p2: number }"],
        valueCode: '{ p1: "hi", p2: 4 }',
        typeDefCode: "I2",
        validTest: { p1: "hi", p2: 4 },
        invalidTest: { p1: "hi" }
    }));
});
