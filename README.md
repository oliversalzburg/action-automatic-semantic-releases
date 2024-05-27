# Automatic Semantic Releases Action

This action is a fork of <https://github.com/marvinpinto/action-automatic-releases>.

## Usage

- Uses git tags to track previous snapshot releases. It writes them back to the repo!

### Tagged Build (Release on Tag Push)

```yml
name: Publish Release

on:
  push:
    tags:
      - "v*"

jobs:
  tagged-release:
    runs-on: ubuntu-22.04
    permissions:
      contents: write
      packages: write
      pull-requests: read

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: your build process
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          # Create only as draft, so we can add a description on the web UI.
          draft: true
          files: |
            output/*
          prerelease: false
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          title: ${{ github.ref_name }}
```

### Version Management

This action assumes that _only_ tagged builds also have a correlating change in the version number that is persisted into the code base. Snapshot releases, like development or nightly builds, all have to be produced from the same version number in the code base. So that these snapshot releases do not conflict with tagged builds with the same version number, a unique version number needs to be generated for snapshot releases.

Due to the complexity of version number management in various kinds of projects, this task is left to the integrator of this action. Most likely, you'd want to generate the version number before your own build anyway, to make it available as part of the artifact labeling process.

[The script that is used in the examples below](./examples/release-version.cjs) can be used as a starting point for your own project.

### Development Build (Release on Push)

```yml
name: Publish Push

on:
  push:
    branches: [main]

env:
  DEV_BUILD: true

jobs:
  pre-release:
    runs-on: ubuntu-22.04
    permissions:
      contents: write
      packages: write
      pull-requests: read

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: echo "RELEASE_VERSION=$(node release-version.cjs)" >> $GITHUB_ENV
      - run: your build process
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          automatic_release_tag: next
          draft: false
          files: |
            output/*
          prerelease: true
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          title: Development Build v${{ env.RELEASE_VERSION }}
```

### Nightly Build (Release on Schedule)

```yml
name: Publish Nightly

on:
  schedule:
    - cron: "12 7 * * *"

env:
  NIGHTLY_BUILD: true

jobs:
  check_date:
    runs-on: ubuntu-22.04
    name: Check latest commit
    outputs:
      should_run: ${{ steps.should_run.outputs.should_run }}
    steps:
      - uses: actions/checkout@v4
      - id: should_run
        continue-on-error: true
        if: ${{ github.event_name == 'schedule' }}
        run: test -z $(git rev-list  --after="24 hours"  ${{ github.sha }}) && echo "name=should_run::false" >> $GITHUB_OUTPUT

  nightly:
    needs: check_date
    if: ${{ needs.check_date.outputs.should_run != 'false' }}
    runs-on: ubuntu-22.04
    permissions:
      contents: write
      packages: write
      pull-requests: read

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: echo "RELEASE_VERSION=$(node release-version.cjs)" >> $GITHUB_ENV
      - run: your build process
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          automatic_release_tag: nightly
          draft: false
          files: |
            output/*
          prerelease: true
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          title: Nightly Build v${{ env.RELEASE_VERSION }}
```

## Examples

### Serial Snapshot Build

This example is highly specific to JavaScript module projects. It assumes a registry of published artifacts with valid semantic version numbers, where the next published snapshot should have a version number following the existing series.

> This process was inspired by the release pipelines of <https://github.com/mikro-orm/mikro-orm>.

```yml
jobs:
  snapshot:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          registry-url: https://registry.npmjs.org
      - run: echo "RELEASE_VERSION=$(node manifest-version.cjs --canary=patch)" >> $GITHUB_ENV
      - env:
          # This registry access token requires write access to the scope used in the manifest.
          # A token that is limited to the package scope is not sufficient to publish a completely new module.
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          npm --no-git-tag-version --ignore-scripts version ${RELEASE_VERSION}
          npm publish --access=public --provenance --tag=next
      - uses: oliversalzburg/action-automatic-semantic-releases@v0.0.5
        with:
          automatic_release_tag: next
          draft: false
          files: |
            output/*
          prerelease: true
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          title: Snapshot Build v${{ env.RELEASE_VERSION }}
```

## Release Process

```shell
npm version patch
```
