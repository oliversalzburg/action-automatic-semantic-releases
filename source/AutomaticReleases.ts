import { isNil } from "@oliversalzburg/js-utils/data/nil.js";
import { readFile, writeFile } from "node:fs/promises";
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
      core.setOutput("version-current", versions.current);
      core.setOutput("version-root", versions.root);
      core.setOutput("version-extension", versions.extension);
      core.setOutput("version-dev", versions.dev);
      core.setOutput("version-dev_extended", versions.devExtended);
      core.setOutput("version-nightly", versions.nightly);
      core.setOutput("version-nightly_extended", versions.nightlyExtended);
      core.setOutput("version-major", versions.major);
      core.setOutput("version-minor", versions.minor);
      core.setOutput("version-patch", versions.patch);
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
          repo: context.repo.repo,
          ref: `tags/${previousReleaseTag}`,
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

      core.setOutput("commits-total", commitsSinceRelease.length);
      core.setOutput("major-total", changelog.breakingChanges.length);
      core.setOutput("minor-total", changelog.feat.length);
      core.setOutput(
        "patch-total",
        changelog.fix.length +
          changelog.perf.length +
          changelog.refactor.length +
          changelog.revert.length +
          changelog.style.length,
      );
      core.setOutput(
        "lifecycle-total",
        changelog.build.length +
          changelog.ci.length +
          changelog.docs.length +
          changelog.test.length,
      );
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
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag_name: tagName,
        name: this.#args.title ? this.#args.title : releaseTag,
        draft: this.#args.draftRelease,
        prerelease: this.#args.preRelease,
        body,
      });

      await uploadReleaseArtifacts(octokit, context, release, this.#args.files);

      core.setOutput("upload-url", release.upload_url);
    }

    core.debug(`Exporting environment variable AUTOMATIC_RELEASES_TAG with value ${tagName}`);
    core.exportVariable("AUTOMATIC_RELEASES_TAG", tagName);
    core.setOutput("automatic-releases-tag", tagName);
  }
}
