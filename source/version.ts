const getDateStringToday = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
};
const getDateStringNow = (date = new Date()) => {
  const hour = `${date.getUTCHours()}`.padStart(2, "0");
  const minute = `${date.getUTCMinutes()}`.padStart(2, "0");
  const second = `${date.getUTCSeconds()}`.padStart(2, "0");
  return `${getDateStringToday(date)}${hour}${minute}${second}`;
};

const getRootVersion = (currentVersion: string) => {
  return currentVersion.replace(/^v?(\d+\.\d+\.\d+)-?.*$/, "$1");
};

const getVersionExtension = (currentVersion: string) => {
  return currentVersion.replace(/^v?\d+\.\d+\.\d+(-?.*)$/, "$1");
};

const bumpVersion = (rootVersion: string, level: "major" | "minor" | "patch") => {
  const parts = rootVersion.split(".");

  switch (level) {
    case "major": {
      parts[0] = `${+parts[0] + 1}`;
      parts[1] = "0";
      parts[2] = "0";
      break;
    }
    case "minor": {
      parts[1] = `${+parts[1] + 1}`;
      parts[2] = "0";
      break;
    }
    case "patch":
    default:
      parts[2] = `${+parts[2] + 1}`;
  }

  return parts.join(".");
};

/**
 * Suggests inferred version strings to distinguish releases of the same base version.
 * @param currentVersion - The current version of the project.
 * @returns A set of suggestions for release versions.
 */
export const suggestVersions = (currentVersion: string, date = new Date()) => {
  const rootVersion = getRootVersion(currentVersion);
  const versionExtension = getVersionExtension(currentVersion);
  const hash = process.env.GITHUB_SHA ? String(process.env.GITHUB_SHA).substring(0, 7) : "unknown";

  const major = bumpVersion(rootVersion, "major");
  const minor = bumpVersion(rootVersion, "minor");
  const patch = bumpVersion(rootVersion, "patch");
  const indexDev = getDateStringNow(date);
  const indexNightly = getDateStringToday(date);

  return {
    current: currentVersion,
    dev: [rootVersion, "-", "dev", ".", indexDev].join(""),
    devExtended: [rootVersion, versionExtension, "-", "dev", ".", indexDev].join(""),
    devExtendedHash: [rootVersion, versionExtension, "-", "dev", ".", indexDev, "+", hash].join(""),
    devHash: [rootVersion, "-", "dev", ".", indexDev, "+", hash].join(""),
    extension: versionExtension,
    major: major,
    majorDev: [major, "-", "dev", ".", indexDev].join(""),
    majorDevHash: [major, "-", "dev", ".", indexDev, "+", hash].join(""),
    majorExtendedDev: [major, versionExtension, "-", "dev", ".", indexDev].join(""),
    majorExtendedDevHash: [major, versionExtension, "-", "dev", ".", indexDev, "+", hash].join(""),
    majorExtendedNightly: [major, versionExtension, "-", "nightly", ".", indexNightly].join(""),
    majorExtendedNightlyHash: [
      major,
      versionExtension,
      "-",
      "nightly",
      ".",
      indexNightly,
      "+",
      hash,
    ].join(""),
    majorHash: [major, "+", hash].join(""),
    majorNightly: [major, "-", "nightly", ".", indexNightly].join(""),
    majorNightlyHash: [major, "-", "nightly", ".", indexNightly, "+", hash].join(""),
    minor: minor,
    minorDev: [minor, "-", "dev", ".", indexDev].join(""),
    minorDevHash: [minor, "-", "dev", ".", indexDev, "+", hash].join(""),
    minorExtendedDev: [minor, versionExtension, "-", "dev", ".", indexDev].join(""),
    minorExtendedDevHash: [minor, versionExtension, "-", "dev", ".", indexDev, "+", hash].join(""),
    minorExtendedNightly: [minor, versionExtension, "-", "nightly", ".", indexNightly].join(""),
    minorExtendedNightlyHash: [
      minor,
      versionExtension,
      "-",
      "nightly",
      ".",
      indexNightly,
      "+",
      hash,
    ].join(""),
    minorHash: [minor, "+", hash].join(""),
    minorNightly: [minor, "-", "nightly", ".", indexNightly].join(""),
    minorNightlyHash: [minor, "-", "nightly", ".", indexNightly, "+", hash].join(""),
    nightly: [rootVersion, "-", "nightly", ".", indexNightly].join(""),
    nightlyExtended: [rootVersion, versionExtension, "-", "nightly", ".", indexNightly].join(""),
    nightlyExtendedHash: [
      rootVersion,
      versionExtension,
      "-",
      "nightly",
      ".",
      indexNightly,
      "+",
      hash,
    ].join(""),
    nightlyHash: [rootVersion, "-", "nightly", ".", indexNightly, "+", hash].join(""),
    patch: patch,
    patchDev: [patch, "-", "dev", ".", indexDev].join(""),
    patchDevHash: [patch, "-", "dev", ".", indexDev, "+", hash].join(""),
    patchExtendedDev: [patch, versionExtension, "-", "dev", ".", indexDev].join(""),
    patchExtendedDevHash: [patch, versionExtension, "-", "dev", ".", indexDev, "+", hash].join(""),
    patchExtendedNightly: [patch, versionExtension, "-", "nightly", ".", indexNightly].join(""),
    patchExtendedNightlyHash: [
      patch,
      versionExtension,
      "-",
      "nightly",
      ".",
      indexNightly,
      "+",
      hash,
    ].join(""),
    patchHash: [patch, "+", hash].join(""),
    patchNightly: [patch, "-", "nightly", ".", indexNightly].join(""),
    patchNightlyHash: [patch, "-", "nightly", ".", indexNightly, "+", hash].join(""),
    root: rootVersion,
  };
};
