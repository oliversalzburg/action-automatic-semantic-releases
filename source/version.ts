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
  const hash = process.env.GITHUB_SHA ? String(process.env.GITHUB_SHA).substring(0, 7) : "";

  const major = bumpVersion(rootVersion, "major");
  const minor = bumpVersion(rootVersion, "minor");
  const patch = bumpVersion(rootVersion, "patch");
  const index = getDateString();

  return {
    current: currentVersion,
    root: rootVersion,
    extension: versionExtension,
    dev: [rootVersion, "-", "dev", ".", index, "+", hash].join(""),
    devExtended: [rootVersion, versionExtension, "-", "dev", ".", index, "+", hash].join(""),
    nightly: [rootVersion, "-", "nightly", ".", index, "+", hash].join(""),
    nightlyExtended: [rootVersion, versionExtension, "-", "nightly", ".", index, "+", hash].join(
      "",
    ),
    major,
    majorDev: [major, "-", "dev", ".", index, "+", hash].join(""),
    majorDevExtended: [major, versionExtension, "-", "dev", ".", index, "+", hash].join(""),
    majorNightly: [major, "-", "nightly", ".", index, "+", hash].join(""),
    majorNightlyExtended: [major, versionExtension, "-", "nightly", ".", index, "+", hash].join(""),
    minor,
    minorDev: [minor, "-", "dev", ".", index, "+", hash].join(""),
    minorDevExtended: [minor, versionExtension, "-", "dev", ".", index, "+", hash].join(""),
    minorNightly: [minor, "-", "nightly", ".", index, "+", hash].join(""),
    minorNightlyExtended: [minor, versionExtension, "-", "nightly", ".", index, "+", hash].join(""),
    patch,
    patchDev: [patch, "-", "dev", ".", index, "+", hash].join(""),
    patchDevExtended: [patch, versionExtension, "-", "dev", ".", index, "+", hash].join(""),
    patchNightly: [patch, "-", "nightly", ".", index, "+", hash].join(""),
    patchNightlyExtended: [patch, versionExtension, "-", "nightly", ".", index, "+", hash].join(""),
  };
};
