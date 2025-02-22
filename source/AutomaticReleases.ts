import { writeFile } from "node:fs/promises";
import { getChangelog, renderChangelog } from "./changelog.js";
import { ActionParameters, AutomaticReleasesOptions, CommitsSinceRelease } from "./types.js";
import { uploadReleaseArtifacts } from "./uploadReleaseArtifacts.js";
import {
  createReleaseTag,
  deletePreviousGitHubRelease,
  generateNewGitHubRelease,
  getCommitsSinceRelease,
  parseGitTag,
  searchForPreviousReleaseTag,
} from "./utils.js";

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

    core.startGroup("Initializing the Automatic Releases action");
    core.debug(`Github context: ${JSON.stringify(context)}`);
    core.debug(`Arguments: ${JSON.stringify(this.#args)}`);
    core.endGroup();

    core.startGroup("Determining release tags");
    const releaseTag = this.#args.automaticReleaseTag
      ? this.#args.automaticReleaseTag
      : parseGitTag(core, context.ref);
    if (!releaseTag) {
      throw new Error(
        `The parameter "automatic_release_tag" was not set and this does not appear to be a GitHub tag event. (Event: ${context.ref})`,
      );
    }

    const previousReleaseTag = this.#args.automaticReleaseTag
      ? this.#args.automaticReleaseTag
      : await searchForPreviousReleaseTag(core, octokit, releaseTag, {
          owner: context.repo.owner,
          repo: context.repo.repo,
        });
    core.endGroup();

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

    const changelog = await getChangelog(
      core,
      octokit,
      context.repo.owner,
      context.repo.repo,
      commitsSinceRelease,
    );
    const changeLogText = renderChangelog(
      core,
      changelog,
      this.#args.withAuthors,
      this.#args.mergeSimilar,
    );

    const filename = this.#args.changelogArtifact;
    if (filename !== "") {
      core.debug(`Writing changelog metadata to '${filename}'...`);
      await writeFile(filename, JSON.stringify(changelog));
      core.debug(`Changelog metadata written to '${filename}'.`);
    }

    core.setOutput("major", changelog.breakingChanges.length);
    core.setOutput("minor", changelog.feat.length);
    core.setOutput(
      "patch",
      changelog.fix.length +
        changelog.perf.length +
        changelog.refactor.length +
        changelog.revert.length +
        changelog.style.length,
    );
    core.setOutput(
      "lifecycle",
      changelog.build.length + changelog.ci.length + changelog.docs.length + changelog.test.length,
    );

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

    const tagName = releaseTag + (this.#args.dryRun ? `-${new Date().getTime()}` : "");
    let body = `${this.#args.bodyPrefix !== "" ? this.#args.bodyPrefix + "\n" : ""}${changeLogText}${this.#args.bodySuffix !== "" ? "\n" + this.#args.bodySuffix : ""}`;
    if (125000 < body.length) {
      core.warning(
        `Release body exceeds 125000 characters! Actual length: ${body.length}. Body will be truncated.`,
      );
      body = body.substring(0, 125000 - 1);
    }

    if (this.#args.publish) {
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

      core.setOutput("upload_url", release.upload_url);
    }

    core.debug(`Exporting environment variable AUTOMATIC_RELEASES_TAG with value ${tagName}`);
    core.exportVariable("AUTOMATIC_RELEASES_TAG", tagName);
    core.setOutput("automatic_releases_tag", tagName);
  }
}
