import * as chai from 'chai';
import { execute } from "../../src/code-gen/executor";
import * as path from 'path';

chai.should();

const testCases = [
    `
import { validator } from 'ts-validator';

interface MyI {
    val: string
}

interface MyI2 extends MyI {
    num: number
}

let c: MyI2 = {val: "hi", num: 7};
validator(c);
`, 
`
import { init as __initTsValidatorTypes } from "../ts-validator-types";
import { validate } from "ts-validator";
__initTsValidatorTypes();
//validate("hello", "./src/my.ts?1");


type MyT = {
    val: string
};

let yy: MyT = {} as any;

validate(yy);
`];

describe("Client side validator smoke tests", () =>
    testCases.forEach((val, i) => it("should not throw " + i, finished => {
        const projDirectory = "C:\\proj";
        const typesFileLocation = "C:\\proj\\ts-validator-types.ts";
        const sourceFileRelativePath = "src\\testFile.ts";
        const sourceFileRelativePathUnix = "./src/testFile.ts";
        const sourceFileName = `${projDirectory}\\${sourceFileRelativePath}`;

        let sourceFile = "";
        let typesFile = "";

        const dependencies = {
            readFile: (x: string) => {
                if (x === sourceFileName) {
                    return Promise.resolve(val);
                }

                throw new Error(`Unknown file read: ${x}`);
            },
            writeFile: (fileName: string, fileContent: string) => {
                // https://github.com/ShaneGH/ts-validator/issues/26
                if (fileName === sourceFileName || fileName.replace(/[\\\/]/g, "\\") === sourceFileName) {
                    sourceFile = fileContent;
                    return Promise.resolve();
                }

                // Error: Unknown file write: C:\proj\ts-validator-types.ts
                if (fileName === typesFileLocation) {
                    typesFile = fileContent;
                    return Promise.resolve();
                }
                
                throw new Error(`Unknown file write: ${fileName}`);
            },
            findClosestProjectDirectory: (fileName: string) => {
                if (fileName === sourceFileName) {
                    return Promise.resolve(projDirectory);
                }

                throw new Error(`Unknown proj dir get: ${fileName}`);
            },
            joinPath: (...parts: string[]) => {
                return path.join.apply(null, parts);
            },
            convertToRelativePath: (pathFrom: string, pathTo: string) => {
                if (pathFrom === sourceFileName && pathTo === `${projDirectory}\\ts-validator-types.ts`) {
                    return sourceFileRelativePath;
                }
                
                if (pathFrom === projDirectory && pathTo === sourceFileName) {
                    return sourceFileRelativePath;
                }

                // Error: Unknown convertToRelativePath: C:\proj C:\proj\src\testFile.ts
                throw new Error(`Unknown convertToRelativePath: ${pathFrom} ${pathTo}`);
            },
            convertRelativePathToUnix: (path: string) => {
                if (path === sourceFileRelativePath) {
                    return sourceFileRelativePathUnix;
                }

                throw new Error(`Unknown convertRelativePathToUnix: ${path}`);
            }
        };

        

        execute(sourceFileName)(dependencies)
            .then(() => {
                sourceFile.should.not.eql("");
                sourceFile.should.not.eql(val);
                typesFile.should.not.eql("");
                
                finished();
            })
            .catch(err => {
                finished(err);
            });
    })));