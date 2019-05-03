import * as _ from 'lodash';
import { scenario, } from '../utils';
import * as chai from 'chai';

chai.should();

describe("...args[]", function () {

    const sc = scenario("t", {
        validateSetup: `function (...t: number[]) {`,
        validateTeardown: "}"
    });

    it("should validate correct array", () => sc.validate([5]).length.should.eq(0));
    it("should validate incorrect array", () => sc.validate([""]).length.should.not.eq(0));
});