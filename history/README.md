# Original Git history

`pre-github.bundle` preserves the complete four-commit history through `2e499537d175f1360a9a3dd05613492917ad3348`, including the initial Rust source checkpoint and the tested WASM version.

The first GitHub Actions run imports these exact Git objects and adds them as a second parent of a normal fast-forward migration commit. Existing commit hashes are preserved. The active tree remains the current GitHub source; no source or remote history is overwritten.

The bundle checksum is verified before import. After import, the same original commits are visible in the repository graph. The bundle also remains available for independent recovery with `git clone history/pre-github.bundle recovered`.
