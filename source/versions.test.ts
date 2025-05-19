import core from "@actions/core";
import { expect } from "chai";
import { it } from "mocha";
import { parseCommit } from "./changelog.js";
import type { CommitSinceRelease } from "./types.js";
import { suggestVersions } from "./version.js";

describe("Version Suggestions", () => {
  it("suggests the expected versions for '1.2.3'", () => {
    const result = suggestVersions("1.2.3", new Date(1747651323000));
    expect(result.current).to.equal("1.2.3", "current");
    expect(result.dev).to.equal("1.2.3-dev.20250519104203", "dev");
    expect(result.devExtended).to.equal("1.2.3-dev.20250519104203", "devExtended");
    expect(result.devExtendedHash).to.equal("1.2.3-dev.20250519104203+unknown", "devExtendedHash");
    expect(result.devHash).to.equal("1.2.3-dev.20250519104203+unknown", "devHash");
    expect(result.extension).to.equal("", "extension");
    expect(result.major).to.equal("2.0.0", "major");
    expect(result.majorDev).to.equal("2.0.0-dev.20250519104203", "majorDev");
    expect(result.majorDevHash).to.equal("2.0.0-dev.20250519104203+unknown", "majorDevHash");
    expect(result.majorExtendedDev).to.equal("2.0.0-dev.20250519104203", "majorExtendedDev");
    expect(result.majorExtendedDevHash).to.equal(
      "2.0.0-dev.20250519104203+unknown",
      "majorExtendedDevHash",
    );
    expect(result.majorExtendedNightly).to.equal("2.0.0-nightly.20250519", "majorExtendedNightly");
    expect(result.majorExtendedNightlyHash).to.equal(
      "2.0.0-nightly.20250519+unknown",
      "majorExtendedNightlyHash",
    );
    expect(result.majorNightly).to.equal("2.0.0-nightly.20250519", "majorNightly");
    expect(result.majorNightlyHash).to.equal("2.0.0-nightly.20250519+unknown", "majorNightlyHash");
    expect(result.minor).to.equal("1.3.0", "minor");
    expect(result.minorDev).to.equal("1.3.0-dev.20250519104203", "minorDev");
    expect(result.minorDevHash).to.equal("1.3.0-dev.20250519104203+unknown", "minorDevHash");
    expect(result.minorExtendedDev).to.equal("1.3.0-dev.20250519104203", "minorExtendedDev");
    expect(result.minorExtendedDevHash).to.equal(
      "1.3.0-dev.20250519104203+unknown",
      "minorExtendedDevHash",
    );
    expect(result.minorExtendedNightly).to.equal("1.3.0-nightly.20250519", "minorExtendedNightly");
    expect(result.minorExtendedNightlyHash).to.equal(
      "1.3.0-nightly.20250519+unknown",
      "minorExtendedNightlyHash",
    );
    expect(result.minorNightly).to.equal("1.3.0-nightly.20250519", "minorNightly");
    expect(result.minorNightlyHash).to.equal("1.3.0-nightly.20250519+unknown", "minorNightlyHash");
    expect(result.nightly).to.equal("1.2.3-nightly.20250519", "nightly");
    expect(result.nightlyExtended).to.equal("1.2.3-nightly.20250519", "nightlyExtended");
    expect(result.nightlyExtendedHash).to.equal(
      "1.2.3-nightly.20250519+unknown",
      "nightlyExtendedHash",
    );
    expect(result.nightlyHash).to.equal("1.2.3-nightly.20250519+unknown", "nightlyHash");
    expect(result.patch).to.equal("1.2.4", "patch");
    expect(result.patchDev).to.equal("1.2.4-dev.20250519104203", "patchDev");
    expect(result.patchDevHash).to.equal("1.2.4-dev.20250519104203+unknown", "patchDevHash");
    expect(result.patchExtendedDev).to.equal("1.2.4-dev.20250519104203", "patchExtendedDev");
    expect(result.patchExtendedDevHash).to.equal(
      "1.2.4-dev.20250519104203+unknown",
      "patchExtendedDevHash",
    );
    expect(result.patchExtendedNightly).to.equal("1.2.4-nightly.20250519", "patchExtendedNightly");
    expect(result.patchExtendedNightlyHash).to.equal(
      "1.2.4-nightly.20250519+unknown",
      "patchExtendedNightlyHash",
    );
    expect(result.patchNightly).to.equal("1.2.4-nightly.20250519", "patchNightly");
    expect(result.patchNightlyHash).to.equal("1.2.4-nightly.20250519+unknown", "patchNightlyHash");

    expect(result.root).to.equal("1.2.3", "root");
  });

  it("suggests the expected versions for '1.2.3-pre.19'", () => {
    const result = suggestVersions("1.2.3-pre.19", new Date(1747651323000));
    expect(result.current).to.equal("1.2.3-pre.19", "current");
    expect(result.dev).to.equal("1.2.3-dev.20250519104203", "dev");
    expect(result.devExtended).to.equal("1.2.3-pre.19-dev.20250519104203", "devExtended");
    expect(result.devExtendedHash).to.equal(
      "1.2.3-pre.19-dev.20250519104203+unknown",
      "devExtendedHash",
    );
    expect(result.devHash).to.equal("1.2.3-dev.20250519104203+unknown", "devHash");
    expect(result.extension).to.equal("-pre.19", "extension");
    expect(result.major).to.equal("2.0.0", "major");
    expect(result.majorDev).to.equal("2.0.0-dev.20250519104203", "majorDev");
    expect(result.majorDevHash).to.equal("2.0.0-dev.20250519104203+unknown", "majorDevHash");
    expect(result.majorExtendedDev).to.equal("2.0.0-pre.19-dev.20250519104203", "majorExtendedDev");
    expect(result.majorExtendedDevHash).to.equal(
      "2.0.0-pre.19-dev.20250519104203+unknown",
      "majorExtendedDevHash",
    );
    expect(result.majorExtendedNightly).to.equal(
      "2.0.0-pre.19-nightly.20250519",
      "majorExtendedNightly",
    );
    expect(result.majorExtendedNightlyHash).to.equal(
      "2.0.0-pre.19-nightly.20250519+unknown",
      "majorExtendedNightlyHash",
    );
    expect(result.majorNightly).to.equal("2.0.0-nightly.20250519", "majorNightly");
    expect(result.majorNightlyHash).to.equal("2.0.0-nightly.20250519+unknown", "majorNightlyHash");
    expect(result.minor).to.equal("1.3.0", "minor");
    expect(result.minorDev).to.equal("1.3.0-dev.20250519104203", "minorDev");
    expect(result.minorDevHash).to.equal("1.3.0-dev.20250519104203+unknown", "minorDevHash");
    expect(result.minorExtendedDev).to.equal("1.3.0-pre.19-dev.20250519104203", "minorExtendedDev");
    expect(result.minorExtendedDevHash).to.equal(
      "1.3.0-pre.19-dev.20250519104203+unknown",
      "minorExtendedDevHash",
    );
    expect(result.minorExtendedNightly).to.equal(
      "1.3.0-pre.19-nightly.20250519",
      "minorExtendedNightly",
    );
    expect(result.minorExtendedNightlyHash).to.equal(
      "1.3.0-pre.19-nightly.20250519+unknown",
      "minorExtendedNightlyHash",
    );
    expect(result.minorNightly).to.equal("1.3.0-nightly.20250519", "minorNightly");
    expect(result.minorNightlyHash).to.equal("1.3.0-nightly.20250519+unknown", "minorNightlyHash");
    expect(result.nightly).to.equal("1.2.3-nightly.20250519", "nightly");
    expect(result.nightlyExtended).to.equal("1.2.3-pre.19-nightly.20250519", "nightlyExtended");
    expect(result.nightlyExtendedHash).to.equal(
      "1.2.3-pre.19-nightly.20250519+unknown",
      "nightlyExtendedHash",
    );
    expect(result.nightlyHash).to.equal("1.2.3-nightly.20250519+unknown", "nightlyHash");
    expect(result.patch).to.equal("1.2.4", "patch");
    expect(result.patchDev).to.equal("1.2.4-dev.20250519104203", "patchDev");
    expect(result.patchDevHash).to.equal("1.2.4-dev.20250519104203+unknown", "patchDevHash");
    expect(result.patchExtendedDev).to.equal("1.2.4-pre.19-dev.20250519104203", "patchExtendedDev");
    expect(result.patchExtendedDevHash).to.equal(
      "1.2.4-pre.19-dev.20250519104203+unknown",
      "patchExtendedDevHash",
    );
    expect(result.patchExtendedNightly).to.equal(
      "1.2.4-pre.19-nightly.20250519",
      "patchExtendedNightly",
    );
    expect(result.patchExtendedNightlyHash).to.equal(
      "1.2.4-pre.19-nightly.20250519+unknown",
      "patchExtendedNightlyHash",
    );
    expect(result.patchNightly).to.equal("1.2.4-nightly.20250519", "patchNightly");
    expect(result.patchNightlyHash).to.equal("1.2.4-nightly.20250519+unknown", "patchNightlyHash");

    expect(result.root).to.equal("1.2.3", "root");
  });
});
