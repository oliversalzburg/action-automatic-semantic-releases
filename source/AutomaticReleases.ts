import { readFile, writeFile } from "node:fs/promises";
import { isNil } from "@oliversalzburg/js-utils/data/nil.js";
import { getChangelog, renderChangelog } from "./changelog.js";
import {
  ActionParameters,
  AutomaticReleasesOptions,
  Changelog,
  CommitsSinceRelease,
} from "./types.js";
import { uploadReleaseArtifacts } from "./uploadReleaseArtifacts.js";
import {
  createReleaseTag,
  deletePreviousGitHubRelease,
  generateNewGitHubRelease,
  getCommitsSinceRelease,
  parseGitTag,
  searchForPreviousReleaseTag,
} from "./utils.js";
import { suggestVersions } from "./version.js";

/**
 * The automatic releases action.
 */
export class AutomaticReleases {
  #args: ActionParameters;
  #options: AutomaticReleasesOptions;

  /**
   * Constructs a new instance of the action.
   * @param options - The options for the action.
   * @param args - The arguments that were passed by the user.
   */
  constructor(options: AutomaticReleasesOptions, args: ActionParameters) {
    this.#options = options;
    this.#args = args;
  }

  /**
   * Execute the action.
   */
  async main() {
    const { context, core, octokit } = this.#options;
    let changelog: Changelog | undefined;

    core.startGroup("Initializing the Automatic Releases action");
    core.debug(`Github context: ${JSON.stringify(context)}`);
    core.info(`Arguments: ${JSON.stringify(this.#args)}`);
    core.endGroup();

    core.startGroup("Determining release tags");
    const releaseTag =
      this.#args.automaticReleaseTag !== ""
        ? this.#args.automaticReleaseTag
        : parseGitTag(core, context.ref);

    const previousReleaseTag =
      this.#args.automaticReleaseTag !== ""
        ? this.#args.automaticReleaseTag
        : await searchForPreviousReleaseTag(core, octokit, releaseTag, {
            owner: context.repo.owner,
            repo: context.repo.repo,
          });
    core.endGroup();

    if (this.#args.automaticReleaseTag === "" || this.#args.rootVersion !== "") {
      const versions = suggestVersions(
        this.#args.rootVersion !== "" ? this.#args.rootVersion : releaseTag,
      );
      core.info(JSON.stringify(versions, undefined, "\t"));

      core.setOutput("version-current", versions.current);
      core.setOutput("version-dev", versions.dev);
      core.setOutput("version-dev-extended", versions.devExtended);
      core.setOutput("version-dev-extended-hash", versions.devExtendedHash);
      core.setOutput("version-dev-hash", versions.devHash);
      core.setOutput("version-extension", versions.extension);
      core.setOutput("version-major", versions.major);
      core.setOutput("version-major-dev", versions.majorDev);
      core.setOutput("version-major-dev-hash", versions.majorDevHash);
      core.setOutput("version-major-extended-dev", versions.majorExtendedDev);
      core.setOutput("version-major-extended-dev-hash", versions.majorExtendedDevHash);
      core.setOutput("version-major-extended-nightly", versions.majorExtendedNightly);
      core.setOutput("version-major-extended-nightly-hash", versions.majorExtendedNightlyHash);
      core.setOutput("version-major-nightly", versions.majorNightly);
      core.setOutput("version-major-nightly-hash", versions.majorNightlyHash);
      core.setOutput("version-minor", versions.minor);
      core.setOutput("version-minor-dev", versions.minorDev);
      core.setOutput("version-minor-dev-hash", versions.minorDevHash);
      core.setOutput("version-minor-extended-dev", versions.minorExtendedDev);
      core.setOutput("version-minor-extended-dev-hash", versions.minorExtendedDevHash);
      core.setOutput("version-minor-extended-nightly", versions.minorExtendedNightly);
      core.setOutput("version-minor-extended-nightly-hash", versions.minorExtendedNightlyHash);
      core.setOutput("version-minor-hash", versions.minorHash);
      core.setOutput("version-minor-nightly", versions.minorNightly);
      core.setOutput("version-minor-nightly-hash", versions.minorNightlyHash);
      core.setOutput("version-nightly", versions.nightly);
      core.setOutput("version-nightly-extended", versions.nightlyExtended);
      core.setOutput("version-nightly-extended-hash", versions.nightlyExtendedHash);
      core.setOutput("version-nightly-hash", versions.nightlyHash);
      core.setOutput("version-patch", versions.patch);
      core.setOutput("version-patch-dev", versions.patchDev);
      core.setOutput("version-patch-dev-hash", versions.patchDevHash);
      core.setOutput("version-patch-extended-dev", versions.patchExtendedDev);
      core.setOutput("version-patch-extended-dev-hash", versions.patchExtendedDevHash);
      core.setOutput("version-patch-extended-nightly", versions.patchExtendedNightly);
      core.setOutput("version-patch-extended-nightly-hash", versions.patchExtendedNightlyHash);
      core.setOutput("version-patch-hash", versions.patchHash);
      core.setOutput("version-patch-nightly", versions.patchNightly);
      core.setOutput("version-patch-nightly-hash", versions.patchNightlyHash);
      core.setOutput("version-root", versions.root);
    }

    if (
      (this.#args.changelogArtifact === "" && this.#args.publish) ||
      (this.#args.changelogArtifact !== "" && !this.#args.publish)
    ) {
      const commitsSinceRelease: CommitsSinceRelease = await getCommitsSinceRelease(
        core,
        octokit,
        {
          owner: context.repo.owner,
          ref: `tags/${previousReleaseTag}`,
          repo: context.repo.repo,
        },
        context.sha,
      );

      changelog = await getChangelog(
        core,
        octokit,
        context.repo.owner,
        context.repo.repo,
        commitsSinceRelease,
      );

      const filename = this.#args.changelogArtifact;
      if (filename !== "") {
        core.info(`Writing changelog metadata to '${filename}'...`);
        await writeFile(filename, JSON.stringify(changelog));
        core.info(`Changelog metadata written to '${filename}'.`);
      }
    }

    const tagName = releaseTag + (this.#args.dryRun ? `-${new Date().getTime()}` : "");

    if (this.#args.publish) {
      if (this.#args.automaticReleaseTag && !this.#args.dryRun) {
        await createReleaseTag(core, octokit, {
          owner: context.repo.owner,
          ref: `refs/tags/${this.#args.automaticReleaseTag}`,
          repo: context.repo.repo,
          sha: context.sha,
        });

        await deletePreviousGitHubRelease(core, octokit, {
          owner: context.repo.owner,
          repo: context.repo.repo,
          tag: this.#args.automaticReleaseTag,
        });
      }

      const filename = this.#args.changelogArtifact;
      if (isNil(changelog)) {
        if (filename === "") {
          throw new Error("No changelog was generated, and no 'changelog-artifact' was provided.");
        }

        core.info(`Reading changelog metadata from '${filename}'...`);
        changelog = JSON.parse(await readFile(filename, "utf8")) as Changelog;
        core.info(`Changelog metadata read from '${filename}'.`);
      }

      const changeLogText = renderChangelog(
        core,
        changelog,
        this.#args.withAuthors,
        this.#args.mergeSimilar,
      );

      let body = `${this.#args.bodyPrefix !== "" ? this.#args.bodyPrefix + "\n" : ""}${changeLogText}${this.#args.bodySuffix !== "" ? "\n" + this.#args.bodySuffix : ""}`;
      if (125000 < body.length) {
        core.warning(
          `Release body exceeds 125000 characters! Actual length: ${body.length}. Body will be truncated.`,
        );
        body = body.substring(0, 125000 - 1);
      }

      const release = await generateNewGitHubRelease(core, octokit, {
        body,
        draft: this.#args.draftRelease,
        name: this.#args.title ? this.#args.title : releaseTag,
        owner: context.repo.owner,
        prerelease: this.#args.preRelease,
        repo: context.repo.repo,
        tag_name: tagName,
      });

      await uploadReleaseArtifacts(octokit, context, release, this.#args.files);

      core.setOutput("upload-url", release.upload_url);
    }

    if (!isNil(changelog)) {
      core.setOutput("commits-total", changelog.commits.length);
      core.setOutput("unconventional-total", changelog.unconventional.length);
      core.setOutput("major-total", changelog.breakingChanges.length);
      core.setOutput("minor-total", changelog.feat.length);
      core.setOutput(
        "patch-total",
        changelog.fix.length +
          changelog.perf.length +
          changelog.refactor.length +
          changelog.revert.length +
          changelog.style.length +
          changelog.deps.feat.length,
      );
      core.setOutput(
        "lifecycle-total",
        changelog.build.length +
          changelog.chore.length +
          changelog.ci.length +
          changelog.docs.length +
          changelog.test.length +
          changelog.deps.build.length +
          changelog.deps.chore.length +
          changelog.deps.ci.length +
          changelog.deps.docs.length +
          changelog.deps.fix.length +
          changelog.deps.perf.length +
          changelog.deps.refactor.length +
          changelog.deps.revert.length +
          changelog.deps.style.length +
          changelog.deps.test.length,
      );
    }

    core.debug(`Exporting environment variable AUTOMATIC_RELEASES_TAG with value ${tagName}`);
    core.exportVariable("AUTOMATIC_RELEASES_TAG", tagName);
    core.setOutput("automatic-releases-tag", tagName);
  }
}
