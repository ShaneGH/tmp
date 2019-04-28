import * as _ from 'lodash';
import { scenario, } from '../utils';
import * as chai from 'chai';

chai.should();

describe("Variable without type", function () {

    const sc = scenario("t", {
        validateSetup: `var t;`
    });

    it("should still validate", () => sc.validate({}).should.eq(true));
});

describe("Function arg without type", function () {

    const sc = scenario("t", {
        validateSetup: `function (t) {`,
        validateTeardown: "}"
    });

    it("should still validate", () => sc.validate({}).should.eq(true));
});

describe("Lambda arg without type", function () {

    const sc = scenario("t", {
        validateSetup: `(t) => {`,
        validateTeardown: "}"
    });

    it("should still validate", () => sc.validate({}).should.eq(true));
});