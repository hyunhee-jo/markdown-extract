<!-- AI-AGENT-SUMMARY
name: md-extract
category: Markdown parser, structured extraction
license: MIT
solves: [Parse Markdown files into structured data, section-level extraction]
input: Markdown files (.md)
output: JSON, text, HTML
sdk: Python
requirements: Python 3.10+
key-differentiators: [CLI + Python API, section filtering, frontmatter extraction, options.json SsoT]
-->

# md-extract

[![CI](https://github.com/hyunhee-jo/md-extract/actions/workflows/ci.yml/badge.svg)](https://github.com/hyunhee-jo/md-extract/actions/workflows/ci.yml)
[![License-Apache_2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

Markdown file parser and structured extraction tool (CLI + Python API).

## Installation

```bash
pip install md-extract
```

## Quick Start

### CLI

```bash
# Extract as JSON
md-extract extract README.md -f json

# Extract specific sections
md-extract extract docs/ -s "Installation,Usage" -f text

# Print table of contents
md-extract toc README.md

# Print frontmatter metadata
md-extract meta blog-post.md
```

### Python API

```python
from md_extract import extract

# Basic extraction
result = extract("README.md", format="json")

# Filter by heading level
result = extract("docs/guide.md", heading_level="1,2", format="text")

# Extract specific sections
result = extract("README.md", sections="Usage", strip_html=True)
```

## Commands

| Command | Description |
|---------|-------------|
| `extract` | Parse Markdown and output structured data (JSON, text, HTML) |
| `toc` | Print the table of contents (heading tree) |
| `meta` | Print frontmatter metadata as JSON |

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `output-dir` | `str` | `None` | Directory where output files are written |
| `format` | `str` | `"json"` | Output format: json, text, html |
| `quiet` | `bool` | `False` | Suppress console logging output |
| `heading-level` | `str` | `None` | Filter by heading levels (comma-separated) |
| `sections` | `str` | `None` | Extract sections by heading text (comma-separated) |
| `include-frontmatter` | `bool` | `True` | Include YAML/TOML frontmatter in output |
| `strip-html` | `bool` | `False` | Strip inline HTML tags |
| `include-code-blocks` | `bool` | `True` | Include fenced code blocks |
| `include-toc` | `bool` | `False` | Add generated table of contents |
| `flatten-lists` | `bool` | `False` | Flatten nested lists |
| `section-separator` | `str` | `None` | Separator between sections in text output |
| `normalize-links` | `bool` | `False` | Convert relative links to absolute |

## Development

```bash
# Install in development mode
pip install -e .

# Run tests
make test

# Run linting
make lint

# Format code
make format
```

## License

[MIT](LICENSE)
