# Evaluation set format

Two halves, `dev` and `heldout`. Rules are written against `dev`. `heldout` is scored once, at the end. Each half has 50 pull requests and 150 traced declarations.

## Pull requests: `<half>/prs/<id>.json`

```json
{
  "id": "h-001",
  "repo": "alert-triage",
  "title": "Add a severity filter",
  "body": "free text",
  "files": { "src/screens/queue.tsx": "full new content, or null to delete" },
  "plants": [
    { "screen": "queue", "testid": "severity-filter", "prop": "height", "kind": "literal", "note": "h-9" }
  ]
}
```

- The base is `customers/northgate/repos/<repo>`. `files` replaces whole files. A new screen also needs its entry in `conform.config.json`.
- `plants` is empty for a clean pull request. A clean one makes a real change that follows the design system.
- The planted element must carry the `data-testid` named in the plant, and one element plants one violation per `prop`.
- `kind` is one of `literal` (a value with no token behind it), `wrong-token` (a token the contract does not allow there), `missing` (a required property left out), `redefined` (a design system variable set by the pull request) or `accessibility`.
- `prop` is one of `height`, `padding-inline`, `padding-block`, `margin-inline`, `margin-block`, `gap`, `background-color`, `color`, `border-color`, `border-radius`, `font-size`, `font-weight`, `box-shadow`. For `accessibility` it is the axe rule id. For `redefined` it is the variable name, and `testid` may be empty when the change is in a stylesheet.
- A planted violation may be in a hover or focus state. Add `"state": "hover"` or `"focus"`.
- Old violations already in the base screen stay as they are and are not plants.

## Traced declarations: `<half>/traces.json`

```json
[
  {
    "id": "t-001",
    "css": ".a { --x: var(--ng-space-small); } .b { padding-left: var(--x); }",
    "html": "<div class=\"a\"><p class=\"b\" id=\"target\">text</p></div>",
    "prop": "padding-left",
    "expect": { "kind": "token", "token": "space.small" }
  }
]
```

- `css` is the author's stylesheet, loaded after the design system's. It can use layers, custom properties, calc, media queries and inline styles in the html.
- `expect.kind` is `token`, `literal` or `neutral` (a reset, keyword, zero or percentage). The label is what a person reading the CSS would say is behind the used value, in the comfortable-light theme.
- `prop` is a physical longhand: `height`, `padding-left`, `padding-top`, `row-gap`, `background-color`, `color`, `border-color` (the top border), `border-radius` (top left), `font-size`, `font-weight` or `box-shadow`.
- Nothing is labeled `unresolved`. That is an answer the checker is allowed to give, not a fact about the CSS.
