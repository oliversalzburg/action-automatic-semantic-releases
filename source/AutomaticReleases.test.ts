import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Moctokit } from "@kie/mock-github";
import { beforeEach, it } from "mocha";
import { AutomaticReleases } from "./AutomaticReleases.js";
import { getAndValidateArgs } from "./utils.js";

describe("Big Picture", () => {
  beforeEach(() => {
    process.env.GITHUB_REF = "refs/heads/main";
    process.env.GITHUB_REPOSITORY = "kitten-science/test";
    process.env.GITHUB_SHA = "c0c8526b12c825637a12e9a700868b9568e5a0b2";
    process.env["INPUT_AUTOMATIC-RELEASE-TAG"] = "next";
    process.env["INPUT_DRAFT"] = "false";
    process.env["INPUT_DRY-RUN"] = "false";
    process.env["INPUT_MERGE-SIMILAR"] = "false";
    process.env["INPUT_PRERELEASE"] = "true";
    process.env["INPUT_PUBLISH"] = "true";
    process.env["INPUT_TITLE"] = "Development Build";
    process.env["INPUT_WITH-AUTHORS"] = "true";
  });

  afterEach(() => {
    delete process.env.GITHUB_REF;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_SHA;
    delete process.env["INPUT_AUTOMATIC-RELEASE-TAG"];
    delete process.env["INPUT_DRAFT"];
    delete process.env["INPUT_DRY-RUN"];
    delete process.env["INPUT_MERGE-SIMILAR"];
    delete process.env["INPUT_PRERELEASE"];
    delete process.env["INPUT_PUBLISH"];
    delete process.env["INPUT_TITLE"];
    delete process.env["INPUT_WITH-AUTHORS"];
  });

  it("runs", async () => {
    const moctokit = new Moctokit();

    moctokit.rest.git
      .getRef({
        owner: "kitten-science",
        ref: encodeURIComponent("tags/next"),
        repo: "test",
      })
      .reply({
        data: {},
        status: 404,
      });

    moctokit.rest.git
      .createRef({
        owner: "kitten-science",
        ref: "refs/tags/next",
        repo: "test",
        sha: "c0c8526b12c825637a12e9a700868b9568e5a0b2",
      })
      .reply({
        data: {},
        status: 201,
      });

    moctokit.rest.repos
      .getReleaseByTag({ owner: "kitten-science", repo: "test", tag: "next" })
      .reply({ data: {}, status: 404 });

    moctokit.rest.repos.createRelease().reply({ data: {}, status: 201 });

    const args = getAndValidateArgs(core);

    const automaticReleases = new AutomaticReleases(
      {
        context,
        core,
        octokit: getOctokit("invalid-token", { request: { fetch } }),
      },
      args,
    );

    await automaticReleases.main();
  });

  it("parses", () => {
    /* intentionally left blank */
  });
});
