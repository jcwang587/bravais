# Contributing

## Setup

Node 22 or newer.

```sh
npm install
npm run demo      # a viewer on the test structures, rebuilt on change
npm run check     # tsc --strict and Prettier
npm test          # unit tests
npm run build     # dist/bravais.js and its declarations
```

`BRAVAIS_CIF_CORPUS=<dir> npm test` also reads every CIF below a directory,
which is the quickest way to find a CIF the parser or the expansion rejects.

## Changes

- Keep `npm run check` and `npm test` green; CI runs both plus the build on
  every push and pull request.
- Format with `npm run format` before committing.
- Add a line to `CHANGELOG.md` under the next version for anything a user
  would notice.
- If you bring in code or data from another project, add it to
  `THIRD_PARTY_NOTICES.md` with its licence and what exactly was taken.

## Releasing

1. Set the new version in `package.json` with `npm version <x.y.z>`, which
   also commits and tags `v<x.y.z>`, and move the changelog entry under that
   version.
2. Push the commit and the tag: `git push && git push --tags`.
3. The release workflow checks, tests, builds, publishes to npm with
   provenance, and opens a GitHub release with generated notes. It needs an
   `NPM_TOKEN` repository secret holding an npm granular access token with
   publish rights to `bravais`.
