import * as _ from 'lodash';
import { fullScenario, ValidateMultiple, ValidationScenarios } from '../utils';

describe("Callbacks", function () {

    describe("validate callback arg with explicit type", () => fullScenario({
        setupCode: [
            "function f(x: (y: string) => void) {",
            "}",
            "f((z: string) => "],
        valueCode: 'z',
        teardownCode: [");"],
        validTest: "hi",
        invalidTest: 2
    }));
    
    describe("validate callback arg with explicit type, parentisized", () => fullScenario({
        setupCode: [
            "function f(x: (y: string) => void) {",
            "}",
            "f(((z: string) => "],
        valueCode: 'z',
        teardownCode: ["));"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("validate callback arg with implicit type", () => fullScenario({
        setupCode: [
            "function f(x: (y: string) => void) {",
            "}",
            "f(z => "],
        valueCode: 'z',
        teardownCode: [");"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("validate callback, as expr with braces", () => fullScenario({
        setupCode: [
            "function f(x: (y: string) => void) {",
            "}",
            "f(x => { "],
        valueCode: 'x',
        teardownCode: ["});"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("validate callback, as function", () => fullScenario({
        setupCode: [
            "function f(x: (y: string) => void) {",
            "}",
            "f(function (x) { "],
        valueCode: 'x',
        teardownCode: ["});"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("validate callback, as function, parentisized", () => fullScenario({
        setupCode: [
            "function f(x: (y: string) => void) {",
            "}",
            "f((function (x) { "],
        valueCode: 'x',
        teardownCode: ["}));"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("nested callbacks, validate first parameter", () => fullScenario({
        setupCode: [
            "function f(x: (y: string) => void) {",
            "}",
            "function g(x: (y: number) => void) {",
            "}",
            "f(x => g(y => "],
        valueCode: 'x',
        teardownCode: ["));"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("nested callbacks, validate second parameter", () => fullScenario({
        setupCode: [
            "function f(fx1: (y1: string) => void) {",
            "}",
            "function g(fx2: (y2: number) => void) {",
            "}",
            "f(x => g(y => "],
        valueCode: 'y',
        teardownCode: ["));"],
        validTest: 2,
        invalidTest: "hi"
    }));

    describe("nested callbacks as one arrow function, validate first parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f(x => y => "],
        valueCode: 'x',
        teardownCode: [");"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("nested callbacks as one arrow function, validate second parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f(x => y => "],
        valueCode: 'y',
        teardownCode: [");"],
        validTest: 2,
        invalidTest: "hi"
    }));

    describe("nested callbacks as one arrow function with parameters named the same", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f(x1 => x1 => "],
        valueCode: 'x1',
        teardownCode: [");"],
        validTest: 2,
        invalidTest: "hi"
    }));
    
    describe("nested callbacks as one function, validate first parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f(function (x) { return function (y) { "],
        valueCode: 'x',
        teardownCode: ["}});"],
        validTest: "hi",
        invalidTest: 2
    }));

    describe("nested callbacks as one function, validate second parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f(function (x) { return function (y) { "],
        valueCode: 'y',
        teardownCode: ["}});"],
        validTest: 2,
        invalidTest: "hi"
    }));

    describe("nested callbacks as one function with parameters named the same", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f(function (x) { return function (x) {"],
        valueCode: 'x',
        teardownCode: ["}});"],
        validTest: 2,
        invalidTest: "hi"
    }));

    describe("nested callbacks as one function, validate first parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f(function (x) { return function (x) {"],
        valueCode: 'x',
        teardownCode: ["}});"],
        validTest: 2,
        invalidTest: "hi"
    }));

    describe("nested callbacks as one function, explicit type contradicts callback definition, validate overridden parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: string) => (y: number) => void) {",
            "}",
            "f((x): ((y1: boolean) => void) => y => "],
        valueCode: 'y',
        teardownCode: ["}});"],
        validTest: true,
        invalidTest: 7
    }));

    describe("even more nested callbacks as one function, explicit type contradicts callback definition, validate overridden parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: any) => (y: any) => (z: any) => void) {",
            "}",
            "f((x): ((y: any) => (z: boolean) => void) => y => z => "],
        valueCode: 'z',
        teardownCode: ["}});"],
        validTest: true,
        invalidTest: 7
    }));

    describe("even more nested callbacks as one function, explicit type contradicts callback definition with implicit any, validate overridden parameter", () => fullScenario({
        setupCode: [
            "function f(fx: (x: any) => (y: any) => (z: boolean) => void) {",
            "}",
            "f((x): ((y: any) => (z) => void) => y => z => "],
        valueCode: 'z',
        teardownCode: ["}});"],
        validTest: new ValidateMultiple(true, "", 4),
        invalidTest: null,
        shouldInvalidate: () => false
    }));
});

// function validate(x: any){}
// function f(fx: (x: any) => (y: any) => (z: any) => void) {
// }

// f((x): ((y: any) => (z: boolean) => void) => y => z => validate(z));