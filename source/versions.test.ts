import assert from "node:assert";
import { describe, it } from "node:test";
import * as core from "@actions/core";
import { parseCommit } from "./changelog.js";
import type { CommitSinceRelease } from "./types.js";
import { suggestVersions } from "./version.js";

describe("Version Suggestions", () => {
  it("suggests the expecteded versions for '1.2.3'", () => {
    const result = suggestVersions("1.2.3", new Date(1747651323000));
    assert.strictEqual(result.current, "1.2.3", "current");
    assert.strictEqual(result.dev, "1.2.3-dev.20250519104203", "dev");
    assert.strictEqual(result.devExtended, "1.2.3-dev.20250519104203", "devExtended");
    assert.strictEqual(
      result.devExtendedHash,
      "1.2.3-dev.20250519104203+unknown",
      "devExtendedHash",
    );
    assert.strictEqual(result.devHash, "1.2.3-dev.20250519104203+unknown", "devHash");
    assert.strictEqual(result.extension, "", "extension");
    assert.strictEqual(result.major, "2.0.0", "major");
    assert.strictEqual(result.majorDev, "2.0.0-dev.20250519104203", "majorDev");
    assert.strictEqual(result.majorDevHash, "2.0.0-dev.20250519104203+unknown", "majorDevHash");
    assert.strictEqual(result.majorExtendedDev, "2.0.0-dev.20250519104203", "majorExtendedDev");
    assert.strictEqual(
      result.majorExtendedDevHash,
      "2.0.0-dev.20250519104203+unknown",
      "majorExtendedDevHash",
    );
    assert.strictEqual(
      result.majorExtendedNightly,
      "2.0.0-nightly.20250519",
      "majorExtendedNightly",
    );
    assert.strictEqual(
      result.majorExtendedNightlyHash,
      "2.0.0-nightly.20250519+unknown",
      "majorExtendedNightlyHash",
    );
    assert.strictEqual(result.majorNightly, "2.0.0-nightly.20250519", "majorNightly");
    assert.strictEqual(
      result.majorNightlyHash,
      "2.0.0-nightly.20250519+unknown",
      "majorNightlyHash",
    );
    assert.strictEqual(result.minor, "1.3.0", "minor");
    assert.strictEqual(result.minorDev, "1.3.0-dev.20250519104203", "minorDev");
    assert.strictEqual(result.minorDevHash, "1.3.0-dev.20250519104203+unknown", "minorDevHash");
    assert.strictEqual(result.minorExtendedDev, "1.3.0-dev.20250519104203", "minorExtendedDev");
    assert.strictEqual(
      result.minorExtendedDevHash,
      "1.3.0-dev.20250519104203+unknown",
      "minorExtendedDevHash",
    );
    assert.strictEqual(
      result.minorExtendedNightly,
      "1.3.0-nightly.20250519",
      "minorExtendedNightly",
    );
    assert.strictEqual(
      result.minorExtendedNightlyHash,
      "1.3.0-nightly.20250519+unknown",
      "minorExtendedNightlyHash",
    );
    assert.strictEqual(result.minorNightly, "1.3.0-nightly.20250519", "minorNightly");
    assert.strictEqual(
      result.minorNightlyHash,
      "1.3.0-nightly.20250519+unknown",
      "minorNightlyHash",
    );
    assert.strictEqual(result.nightly, "1.2.3-nightly.20250519", "nightly");
    assert.strictEqual(result.nightlyExtended, "1.2.3-nightly.20250519", "nightlyExtended");
    assert.strictEqual(
      result.nightlyExtendedHash,
      "1.2.3-nightly.20250519+unknown",
      "nightlyExtendedHash",
    );
    assert.strictEqual(result.nightlyHash, "1.2.3-nightly.20250519+unknown", "nightlyHash");
    assert.strictEqual(result.patch, "1.2.4", "patch");
    assert.strictEqual(result.patchDev, "1.2.4-dev.20250519104203", "patchDev");
    assert.strictEqual(result.patchDevHash, "1.2.4-dev.20250519104203+unknown", "patchDevHash");
    assert.strictEqual(result.patchExtendedDev, "1.2.4-dev.20250519104203", "patchExtendedDev");
    assert.strictEqual(
      result.patchExtendedDevHash,
      "1.2.4-dev.20250519104203+unknown",
      "patchExtendedDevHash",
    );
    assert.strictEqual(
      result.patchExtendedNightly,
      "1.2.4-nightly.20250519",
      "patchExtendedNightly",
    );
    assert.strictEqual(
      result.patchExtendedNightlyHash,
      "1.2.4-nightly.20250519+unknown",
      "patchExtendedNightlyHash",
    );
    assert.strictEqual(result.patchNightly, "1.2.4-nightly.20250519", "patchNightly");
    assert.strictEqual(
      result.patchNightlyHash,
      "1.2.4-nightly.20250519+unknown",
      "patchNightlyHash",
    );

    assert.strictEqual(result.root, "1.2.3", "root");
  });

  it("suggests the expecteded versions for '1.2.3-pre.19'", () => {
    const result = suggestVersions("1.2.3-pre.19", new Date(1747651323000));
    assert.strictEqual(result.current, "1.2.3-pre.19", "current");
    assert.strictEqual(result.dev, "1.2.3-dev.20250519104203", "dev");
    assert.strictEqual(result.devExtended, "1.2.3-pre.19-dev.20250519104203", "devExtended");
    assert.strictEqual(
      result.devExtendedHash,
      "1.2.3-pre.19-dev.20250519104203+unknown",
      "devExtendedHash",
    );
    assert.strictEqual(result.devHash, "1.2.3-dev.20250519104203+unknown", "devHash");
    assert.strictEqual(result.extension, "-pre.19", "extension");
    assert.strictEqual(result.major, "2.0.0", "major");
    assert.strictEqual(result.majorDev, "2.0.0-dev.20250519104203", "majorDev");
    assert.strictEqual(result.majorDevHash, "2.0.0-dev.20250519104203+unknown", "majorDevHash");
    assert.strictEqual(
      result.majorExtendedDev,
      "2.0.0-pre.19-dev.20250519104203",
      "majorExtendedDev",
    );
    assert.strictEqual(
      result.majorExtendedDevHash,
      "2.0.0-pre.19-dev.20250519104203+unknown",
      "majorExtendedDevHash",
    );
    assert.strictEqual(
      result.majorExtendedNightly,
      "2.0.0-pre.19-nightly.20250519",
      "majorExtendedNightly",
    );
    assert.strictEqual(
      result.majorExtendedNightlyHash,
      "2.0.0-pre.19-nightly.20250519+unknown",
      "majorExtendedNightlyHash",
    );
    assert.strictEqual(result.majorNightly, "2.0.0-nightly.20250519", "majorNightly");
    assert.strictEqual(
      result.majorNightlyHash,
      "2.0.0-nightly.20250519+unknown",
      "majorNightlyHash",
    );
    assert.strictEqual(result.minor, "1.3.0", "minor");
    assert.strictEqual(result.minorDev, "1.3.0-dev.20250519104203", "minorDev");
    assert.strictEqual(result.minorDevHash, "1.3.0-dev.20250519104203+unknown", "minorDevHash");
    assert.strictEqual(
      result.minorExtendedDev,
      "1.3.0-pre.19-dev.20250519104203",
      "minorExtendedDev",
    );
    assert.strictEqual(
      result.minorExtendedDevHash,
      "1.3.0-pre.19-dev.20250519104203+unknown",
      "minorExtendedDevHash",
    );
    assert.strictEqual(
      result.minorExtendedNightly,
      "1.3.0-pre.19-nightly.20250519",
      "minorExtendedNightly",
    );
    assert.strictEqual(
      result.minorExtendedNightlyHash,
      "1.3.0-pre.19-nightly.20250519+unknown",
      "minorExtendedNightlyHash",
    );
    assert.strictEqual(result.minorNightly, "1.3.0-nightly.20250519", "minorNightly");
    assert.strictEqual(
      result.minorNightlyHash,
      "1.3.0-nightly.20250519+unknown",
      "minorNightlyHash",
    );
    assert.strictEqual(result.nightly, "1.2.3-nightly.20250519", "nightly");
    assert.strictEqual(result.nightlyExtended, "1.2.3-pre.19-nightly.20250519", "nightlyExtended");
    assert.strictEqual(
      result.nightlyExtendedHash,
      "1.2.3-pre.19-nightly.20250519+unknown",
      "nightlyExtendedHash",
    );
    assert.strictEqual(result.nightlyHash, "1.2.3-nightly.20250519+unknown", "nightlyHash");
    assert.strictEqual(result.patch, "1.2.4", "patch");
    assert.strictEqual(result.patchDev, "1.2.4-dev.20250519104203", "patchDev");
    assert.strictEqual(result.patchDevHash, "1.2.4-dev.20250519104203+unknown", "patchDevHash");
    assert.strictEqual(
      result.patchExtendedDev,
      "1.2.4-pre.19-dev.20250519104203",
      "patchExtendedDev",
    );
    assert.strictEqual(
      result.patchExtendedDevHash,
      "1.2.4-pre.19-dev.20250519104203+unknown",
      "patchExtendedDevHash",
    );
    assert.strictEqual(
      result.patchExtendedNightly,
      "1.2.4-pre.19-nightly.20250519",
      "patchExtendedNightly",
    );
    assert.strictEqual(
      result.patchExtendedNightlyHash,
      "1.2.4-pre.19-nightly.20250519+unknown",
      "patchExtendedNightlyHash",
    );
    assert.strictEqual(result.patchNightly, "1.2.4-nightly.20250519", "patchNightly");
    assert.strictEqual(
      result.patchNightlyHash,
      "1.2.4-nightly.20250519+unknown",
      "patchNightlyHash",
    );

    assert.strictEqual(result.root, "1.2.3", "root");
  });
});
