/* eslint-disable no-unused-expressions */
import { expect } from "chai";
import { describe, it } from "mocha";
import { nothing } from "./main.js";

describe("main", () => {
  it("should export nothing", () => {
    expect(nothing).to.be.undefined;
  });
});
