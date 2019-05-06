import * as _ from 'lodash';
import { fullScenario, ValidateMultiple, ValidationScenarios } from '../utils';

describe("Union and intersection types", function () {

    describe("union type", () => fullScenario({
        valueCode: '3',
        typeDefCode: "string | number | {hi: boolean}",
        validTest: new ValidateMultiple("hi", 3, {hi:false}),
        invalidTest: {},
        shouldValidate: x => x != ValidationScenarios.direct && x != ValidationScenarios.variable
    }));

    describe("intersection type", () => fullScenario({
        valueCode: '{hi:false, bi: "xx"}',
        typeDefCode: "{bi: string} & {hi: boolean}",
        validTest: {hi:false, bi: "xx"},
        invalidTest: {hi:false}
    }));

    describe("combined union intersection type", () => fullScenario({
        valueCode: '{hi:false, bi: "xx"}',
        typeDefCode: "string | {bi: string} & {hi: boolean}",
        validTest: new ValidateMultiple("hi", {hi:false, bi: "xx"}),
        invalidTest: {},
        shouldValidate: x => x != ValidationScenarios.direct && x != ValidationScenarios.variable
    }));
});