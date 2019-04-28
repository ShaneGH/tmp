import * as _ from 'lodash';
import { fullScenario, ValidationScenarios, ArrayValidator } from '../utils';

describe("Type literals", function () {

    describe("empty object", () => fullScenario({
        valueCode: '{}',
        typeDefCode: "object",
        validTest: {},
        invalidTest: 2,
        shouldInvalidate: x => x != ValidationScenarios.variable && x != ValidationScenarios.direct
    }));

    describe("complex object", () => fullScenario({
        valueCode: '{x: 5, "y": {4: true}}',
        typeDefCode: '{x: number, "y": {4: boolean}}',
        validTest: {x: 7, y: {"4": false}},
        invalidTest: {x: 7, y: {four: false}}
    }));

    describe("object with convert 1", () => fullScenario({
        valueCode: '{x: 5 as string}',
        typeDefCode: '{x: string}',
        validTest: {x: "hi"},
        invalidTest: {x: 7}
    }));

    describe("object with convert 1", () => fullScenario({
        valueCode: '{x: <string>5}',
        typeDefCode: '{x: string}',
        validTest: {x: "hi"},
        invalidTest: {x: 7}
    }));

    describe("object with array", () => fullScenario({
        valueCode: '{x: [5]}',
        typeDefCode: '{x: number[]}',
        validTest: {x: [5]},
        invalidTest: {x: ["hi"]}
    }));

    describe("empty array, where validTest is empty", () => fullScenario({
        valueCode: '[]',
        typeDefCode: 'number[]',
        validTest: [],
        invalidTest: ["hi"]
    }));

    describe("empty array, where validTest has values", () => fullScenario({
        valueCode: '[]',
        typeDefCode: 'number[]',
        validTest: [3, 4],
        invalidTest: new ArrayValidator(["hi"], [3, "hi"]),
        shouldValidate: x => x != ValidationScenarios.variable && x != ValidationScenarios.direct
    }));

    describe("typed array, where validTest is empty", () => fullScenario({
        valueCode: '[4]',
        typeDefCode: 'number[]',
        validTest: [],
        invalidTest: ["hi"]
    }));

    describe("typed array, where validTest has values", () => fullScenario({
        valueCode: '[6]',
        typeDefCode: 'number[]',
        validTest: [3, 4],
        invalidTest: new ArrayValidator(["hi"], [3, "hi"]),
        shouldValidate: x => x != ValidationScenarios.variable && x != ValidationScenarios.direct
    }));

    describe("typed array, where type is union type", () => fullScenario({
        valueCode: '[6, "6"]',
        typeDefCode: '(number | string)[]',
        validTest: new ArrayValidator([3, "4"], [""], []),
        invalidTest: new ArrayValidator(true),
        shouldValidate: x => x != ValidationScenarios.variable && x != ValidationScenarios.direct
    }));

    describe("typed array, where type is complex type", () => fullScenario({
        valueCode: '[{hi: 77}]',
        typeDefCode: '{hi: number}[]',
        validTest: [{hi: 77}],
        invalidTest: [{hi: "77"}]
    }));
});