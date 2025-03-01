const getDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
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
export const suggestVersions = (currentVersion: string) => {
  const rootVersion = getRootVersion(currentVersion);
  const versionExtension = getVersionExtension(currentVersion);
  const hash = process.env.GITHUB_SHA ? `-${String(process.env.GITHUB_SHA).substring(0, 7)}` : "";

  const major = bumpVersion(rootVersion, "major");
  const minor = bumpVersion(rootVersion, "minor");
  const patch = bumpVersion(rootVersion, "patch");

  return {
    current: currentVersion,
    root: rootVersion,
    extension: versionExtension,
    dev: [rootVersion, "-dev", hash].join(""),
    devExtended: [rootVersion, versionExtension, "-dev", hash].join(""),
    nightly: [rootVersion, `-${getDateString()}`, hash].join(""),
    nightlyExtended: [rootVersion, versionExtension, `-${getDateString()}`, hash].join(""),
    major,
    majorDev: [major, "-dev", hash].join(""),
    majorDevExtended: [major, versionExtension, "-dev", hash].join(""),
    majorNightly: [major, `-${getDateString()}`, hash].join(""),
    majorNightlyExtended: [major, versionExtension, `-${getDateString()}`, hash].join(""),
    minor,
    minorDev: [minor, "-dev", hash].join(""),
    minorDevExtended: [minor, versionExtension, "-dev", hash].join(""),
    minorNightly: [minor, `-${getDateString()}`, hash].join(""),
    minorNightlyExtended: [minor, versionExtension, `-${getDateString()}`, hash].join(""),
    patch,
    patchDev: [patch, "-dev", hash].join(""),
    patchDevExtended: [patch, versionExtension, "-dev", hash].join(""),
    patchNightly: [patch, `-${getDateString()}`, hash].join(""),
    patchNightlyExtended: [patch, versionExtension, `-${getDateString()}`, hash].join(""),
  };
};
