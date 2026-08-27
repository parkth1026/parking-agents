# Vendored TOML parser

This directory contains the runtime files from `toml` 4.3.0 (`toml-node`),
licensed under the MIT license. The upstream parser implements TOML 1.1.0,
which is a superset of the TOML 1.0 syntax accepted by the run interface.

Source: <https://github.com/BinaryMuse/toml-node/tree/v4.3.0>

The runner uses only `parse`; the files are vendored so a generated repository
needs no package installation or network access to read `run.toml`.
