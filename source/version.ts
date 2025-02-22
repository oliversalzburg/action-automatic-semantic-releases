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

  return {
    current: currentVersion,
    root: rootVersion,
    extension: versionExtension,
    dev: [
      rootVersion,
      "-dev",
      process.env.GITHUB_SHA ? `-${String(process.env.GITHUB_SHA).substring(0, 7)}` : "",
    ].join(""),
    devExtended: [
      rootVersion,
      versionExtension,
      "-dev",
      process.env.GITHUB_SHA ? `-${String(process.env.GITHUB_SHA).substring(0, 7)}` : "",
    ].join(""),
    nightly: [
      rootVersion,
      `-${getDateString()}`,
      process.env.GITHUB_SHA ? `-${String(process.env.GITHUB_SHA).substring(0, 7)}` : "",
    ].join(""),
    nightlyExtended: [
      rootVersion,
      versionExtension,
      `-${getDateString()}`,
      process.env.GITHUB_SHA ? `-${String(process.env.GITHUB_SHA).substring(0, 7)}` : "",
    ].join(""),
    major: bumpVersion(rootVersion, "major"),
    minor: bumpVersion(rootVersion, "minor"),
    patch: bumpVersion(rootVersion, "patch"),
  };
};
