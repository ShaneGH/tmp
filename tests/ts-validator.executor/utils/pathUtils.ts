import * as chai from 'chai';
import { convertToRelativePath } from '../../../ts-validator.executor/src/utils/pathUtils';

chai.should();

describe("pathUtils", function () {

    describe("convertToRelativePath", function () {
            
        it("should return absolute path if files are on different drives", () => {
            convertToRelativePath("C:\\dir\\here\\file.ts", "D:\\dir\\here\\file.ts").should.eq("D:\\dir\\here\\file.ts");
        });
            
        it("should return file name if files are in the same dir", () => {
            convertToRelativePath("D:\\dir\\here\\file.ts", "D:\\dir\\here\\file.ts").should.eq("file.ts", "1");
            convertToRelativePath("D:\\dir\\here", "D:\\dir\\here\\file.ts").should.eq("file.ts", "2");
            convertToRelativePath("D:\\dir\\here\\file.ts", "D:\\dir\\here").should.eq("", "3");
            convertToRelativePath("D:\\dir\\here", "D:\\dir\\here").should.eq("", "4");
            convertToRelativePath("D:\\dir\\here\\", "D:\\dir\\here\\file.ts").should.eq("file.ts", "5");
            convertToRelativePath("D:\\dir\\here\\file.ts", "D:\\dir\\here\\").should.eq("", "6");
        });
            
        it("should return relative path if from is above to", () => {
            convertToRelativePath("D:\\dir\\file.ts", "D:\\dir\\here\\file.ts").should.eq("here\\file.ts", "1");
            convertToRelativePath("D:\\dir\\", "D:\\dir\\here\\file.ts").should.eq("here\\file.ts", "2");
            convertToRelativePath("D:\\dir\\file.ts", "D:\\dir\\here").should.eq("here", "3");
            convertToRelativePath("D:\\dir", "D:\\dir\\here").should.eq("here", "4");
            convertToRelativePath("D:\\dir\\", "D:\\dir\\here").should.eq("here", "5");
            convertToRelativePath("D:\\dir", "D:\\dir\\here\\").should.eq("here", "6");
        });
            
        it("should return relative path if from is above to", () => {
            convertToRelativePath("D:\\dir\\here\\file.ts", "D:\\dir\\file.ts").should.eq("..\\file.ts", "1");
            convertToRelativePath("D:\\dir\\here\\", "D:\\dir\\file.ts").should.eq("..\\file.ts", "2");
            convertToRelativePath("D:\\dir\\here\\file.ts", "D:\\dir").should.eq("..", "3");
            convertToRelativePath("D:\\dir\\here", "D:\\dir").should.eq("..", "4");
            convertToRelativePath("D:\\dir\\here\\", "D:\\dir").should.eq("..", "5");
            convertToRelativePath("D:\\dir\\here", "D:\\dir\\").should.eq("..", "6");
        });
    });
});
