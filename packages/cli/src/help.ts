export const HELP = `drop - Drop a folder. Get a URL.

Usage
  drop deploy <folder> [options]   Publish a folder of static files
  drop list [--json]               List your drops
  drop delete <path> [--yes]       Delete a drop and free its path
  drop open <path>                 Open a drop in your browser
  drop login [--url <controlUrl>]  Sign in (opens your browser)
  drop logout                      Forget the stored credential
  drop whoami [--json]             Show who you are signed in as

Deploy options
  --path <name>   Path to publish under (default: suggested from the folder name)
  --permanent     Never expire (default: expires in 30 days)
  --spa           Serve index.html for unknown routes
  --yes, -y       Skip prompts (use the suggested path)
  --json          Print one line of JSON on stdout

Global options
  --url <controlUrl>   Drop control URL for this command
  --help, -h           Show this help
  --version            Show the CLI version

Environment
  DROP_URL     Control URL (overridden by --url)
  DROP_TOKEN   API token, for CI (skips the stored credential)

The folder must contain index.html at its root, and assets should be
referenced relatively - sites are served under /<path>/.

Examples
  drop deploy ./dist --path route-optimizer
  drop deploy ./out --permanent --json
`;
