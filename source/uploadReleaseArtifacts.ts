import * as core from "@actions/core";
import { Context } from "@actions/github/lib/context.js";
import { type GitHub } from "@actions/github/lib/utils.js";
import { RestEndpointMethodTypes } from "@octokit/rest";
import { fdir } from "fdir";
import crypto from "node:crypto";
import fs, { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import picomatch from "picomatch";
import { NewGitHubRelease } from "./types.js";

/**
 * The type of the API response for uploading a release asset.
 */
export type UploadReleaseAssetOptions =
  RestEndpointMethodTypes["repos"]["uploadReleaseAsset"]["parameters"];

/**
 * Uploads files to a GitHub release.
 * @param client - The API client to use.
 * @param context - The execution context.
 * @param release - The release to upload to.
 * @param files - The files to upload to the release.
 */
export const uploadReleaseArtifacts = async (
  client: InstanceType<typeof GitHub>,
  context: Context,
  release: NewGitHubRelease,
  files: Array<string>,
): Promise<void> => {
  const createHashFromFile = (filePath: string): Promise<string> =>
    new Promise(resolve => {
      const hash = crypto.createHash("sha256");
      fs.createReadStream(filePath)
        .on("data", data => hash.update(data))
        .on("end", () => {
          resolve(hash.digest("hex"));
        });
    });

  core.startGroup("Uploading release artifacts");

  for (const fileGlob of files) {
    const paths = await new fdir({
      globFunction: (glob: string) => picomatch(glob),
      relativePaths: true,
    })
      .glob(fileGlob)
      .crawl(process.cwd())
      .withPromise();

    if (paths.length === 0) {
      core.error(`${fileGlob} doesn't match any files`);
    }

    for (const filePath of paths) {
      core.info(`Uploading: ${filePath}`);
      const nameWithExt = path.basename(filePath);
      const uploadArgs: UploadReleaseAssetOptions = {
        owner: context.repo.owner,
        repo: context.repo.repo,
        release_id: release.id,
        url: release.upload_url,
        headers: {
          "content-length": lstatSync(filePath).size,
          "content-type": "application/octet-stream",
        },
        name: nameWithExt,
        data: readFileSync(filePath) as unknown as string,
      };

      try {
        await client.rest.repos.uploadReleaseAsset(uploadArgs);
      } catch (err) {
        core.info(
          `Problem uploading ${filePath} as a release asset (${
            (err as Error).message
          }). Will retry with the SHA256 hash appended to the filename.`,
        );
        const hash = await createHashFromFile(filePath);
        const basename = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath);
        const newName = `${basename}-${hash}${ext}`;
        await client.rest.repos.uploadReleaseAsset({
          ...uploadArgs,
          name: newName,
        });
      }
    }
  }
  core.endGroup();
};
