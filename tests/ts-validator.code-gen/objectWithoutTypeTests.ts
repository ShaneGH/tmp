import * as _ from 'lodash';
import { scenario, } from '../utils';
import * as chai from 'chai';

chai.should();

describe("Variable without type", function () {

    const sc = scenario("t", {
        validateSetup: `var t;`
    });

    if (!sc) return;
    it("should still validate", () => sc.validate({}).length.should.eq(0));
});

describe("Function arg without type", function () {

    const sc = scenario("t", {
        validateSetup: `function (t) {`,
        validateTeardown: "}"
    });

    if (!sc) return;
    it("should still validate", () => sc.validate({}).length.should.eq(0));
});

describe("Lambda arg without type", function () {

    const sc = scenario("t", {
        validateSetup: `(t) => {`,
        validateTeardown: "}"
    });

    if (!sc) return;
    it("should still validate", () => sc.validate({}).length.should.eq(0));
});