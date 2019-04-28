import * as _ from 'lodash';
import { scenario, } from '../utils';
import * as chai from 'chai';

chai.should();

describe("...args[]", function () {

    const sc = scenario("t", {
        validateSetup: `function (...t: number[]) {`,
        validateTeardown: "}"
    });

    it("should validate correct array", () => sc.validate([5]).should.eq(true));
    it("should validate incorrect array", () => sc.validate([""]).should.eq(false));
});