import * as _ from 'lodash';
import { scenario } from '../utils';
import * as chai from 'chai';

chai.should();

describe("...args[]", function () {

    const sc = scenario("t", {
        validateSetup: `function (...t: number[]) {`,
        validateTeardown: "}"
    });

    it("should validate correct array", () => sc.expectSuccess([5]));
    it("should validate incorrect array", () => sc.expectFailure([""]));
});

describe("optional arg", function () {

    const sc = scenario("t", {
        validateSetup: `function (t?: number) {`,
        validateTeardown: "}"
    });

    it("should validate arg with value", () => sc.expectSuccess(5));
    it("should validate arg without value, 1", () => sc.expectSuccess(null));
    it("should validate arg without value, 2", () => sc.expectSuccess(undefined));
    it("should not validate incorrect arg with value", () => sc.expectFailure(""));
});