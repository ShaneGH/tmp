import * as _ from 'lodash';
import { fullScenario } from '../utils';

describe("Raw property keywords", function () {

    describe("string 1", () => fullScenario({
        valueCode: '"hello"',
        typeDefCode: "string",
        validTest: "a string",
        invalidTest: 2
    }));

    describe("string 2", () => fullScenario({
        valueCode: "'hello'",
        typeDefCode: "string",
        validTest: "a string",
        invalidTest: 2
    }));

    describe("string 3", () => fullScenario({
        valueCode: "`hello`",
        typeDefCode: "string",
        validTest: "a string",
        invalidTest: 2
    }));

    describe("string 4", () => fullScenario({
        valueCode: "`${55}`",
        typeDefCode: "string",
        validTest: "a string",
        invalidTest: 2
    }));

    describe("number", () => fullScenario({
        valueCode: '2',
        typeDefCode: "number",
        validTest: 4,
        invalidTest: "bad"
    }));

    describe("bool true", () => fullScenario({
        valueCode: 'true',
        typeDefCode: "boolean",
        validTest: true,
        invalidTest: 2
    }));

    describe("bool false", () => fullScenario({
        valueCode: 'false',
        typeDefCode: "boolean",
        validTest: true,
        invalidTest: 2
    }));

    describe("null", () => fullScenario({
        valueCode: 'null',
        typeDefCode: "null",
        validTest: null,
        invalidTest: 2
    }));

    describe("undefined", () => fullScenario({
        valueCode: 'undefined',
        typeDefCode: "undefined",
        validTest: undefined,
        invalidTest: 2
    }));

    describe("any", () => fullScenario({
        valueCode: 'null',
        typeDefCode: "any",
        validTest: 4,
        invalidTest: 2,
        shouldInvalidate: () => false,
        skipNonTyped: true
    }));

    describe("never", () => fullScenario({
        valueCode: 'null',
        typeDefCode: "never",
        validTest: null,
        invalidTest: 2,
        shouldValidate: () => false
    }));
});
